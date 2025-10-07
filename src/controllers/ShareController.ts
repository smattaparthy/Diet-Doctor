import { Request, Response } from 'express';
import PDFDocument from 'pdfkit';
import { randomBytes } from 'crypto';
import { DatabaseConnection } from '../database/connection';
import { ApiResponse } from '../types';
import { mealPlanGenerator } from '../services/MealPlanGenerator';

const db = DatabaseConnection.getInstance();

/**
 * Share Controller
 * Handles meal plan export and sharing functionality
 */
export class ShareController {
  /**
   * POST /api/v1/meal-plans/:id/export
   * Export meal plan as PDF
   */
  async exportMealPlan(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const planId = parseInt(id);

      // Fetch meal plan with items
      const mealPlan = await mealPlanGenerator.getMealPlan(planId);

      if (!mealPlan) {
        res.status(404).json({
          success: false,
          error: 'Meal plan not found'
        } as ApiResponse);
        return;
      }

      // Fetch recipe details
      const recipeIds = mealPlan.items.map(item => item.recipe_id);
      const recipes = await this.getRecipesByIds(recipeIds);
      const recipeMap = recipes.reduce((acc, recipe) => {
        acc[recipe.id] = recipe;
        return acc;
      }, {} as any);

      // Create PDF document
      const doc = new PDFDocument({
        size: 'LETTER',
        margins: { top: 50, bottom: 50, left: 50, right: 50 }
      });

      // Set response headers for PDF download
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="meal-plan-${mealPlan.name.replace(/\s+/g, '-')}.pdf"`);

      // Pipe PDF to response
      doc.pipe(res);

      // Generate PDF content
      await this.generatePDFContent(doc, mealPlan, recipeMap);

      // Finalize PDF
      doc.end();

    } catch (error: any) {
      console.error('Error exporting meal plan:', error);

      // If headers not sent yet, send error response
      if (!res.headersSent) {
        res.status(500).json({
          success: false,
          error: error.message || 'Failed to export meal plan'
        } as ApiResponse);
      }
    }
  }

  /**
   * POST /api/v1/meal-plans/:id/share
   * Generate shareable link for meal plan
   */
  async generateShareLink(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const planId = parseInt(id);

      // Verify meal plan exists
      const mealPlan = await mealPlanGenerator.getMealPlan(planId);

      if (!mealPlan) {
        res.status(404).json({
          success: false,
          error: 'Meal plan not found'
        } as ApiResponse);
        return;
      }

      // Generate unique share token
      const shareToken = randomBytes(16).toString('hex');

      // Calculate expiration date (30 days from now)
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 30);

      // Store share token in database
      await db.run(
        `INSERT INTO meal_plan_shares (plan_id, share_token, expires_at)
         VALUES (?, ?, ?)`,
        [planId, shareToken, expiresAt.toISOString()]
      );

      // Generate share URL
      const baseUrl = process.env.BASE_URL || 'http://localhost:3000';
      const shareUrl = `${baseUrl}/shared/${shareToken}`;

      res.status(201).json({
        success: true,
        data: {
          shareToken,
          shareUrl,
          expiresAt: expiresAt.toISOString()
        },
        message: 'Share link generated successfully'
      } as ApiResponse);

    } catch (error: any) {
      console.error('Error generating share link:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to generate share link'
      } as ApiResponse);
    }
  }

  /**
   * GET /api/v1/shared/:shareToken
   * Get meal plan by share token (NO AUTH REQUIRED)
   */
  async getSharedMealPlan(req: Request, res: Response): Promise<void> {
    try {
      const { shareToken } = req.params;

      // Fetch share record
      const shareRecord: any = await db.get(
        `SELECT * FROM meal_plan_shares WHERE share_token = ?`,
        [shareToken]
      );

      if (!shareRecord) {
        res.status(404).json({
          success: false,
          error: 'Share link not found or expired'
        } as ApiResponse);
        return;
      }

      // Check if link has expired
      const expiresAt = new Date(shareRecord.expires_at);
      if (expiresAt < new Date()) {
        res.status(410).json({
          success: false,
          error: 'Share link has expired'
        } as ApiResponse);
        return;
      }

      // Fetch meal plan
      const mealPlan = await mealPlanGenerator.getMealPlan(shareRecord.plan_id);

      if (!mealPlan) {
        res.status(404).json({
          success: false,
          error: 'Meal plan not found'
        } as ApiResponse);
        return;
      }

      // Fetch recipe details
      const recipeIds = mealPlan.items.map(item => item.recipe_id);
      const recipes = await this.getRecipesByIds(recipeIds);

      res.status(200).json({
        success: true,
        data: {
          mealPlan,
          recipeDetails: recipes,
          sharedAt: shareRecord.created_at,
          expiresAt: shareRecord.expires_at
        }
      } as ApiResponse);

    } catch (error: any) {
      console.error('Error fetching shared meal plan:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to fetch shared meal plan'
      } as ApiResponse);
    }
  }

  /**
   * Helper: Generate PDF content
   */
  private async generatePDFContent(doc: PDFKit.PDFDocument, mealPlan: any, recipeMap: any): Promise<void> {
    // Title and Header
    doc.fontSize(24).font('Helvetica-Bold').text(mealPlan.name, { align: 'center' });
    doc.moveDown(0.5);

    doc.fontSize(12).font('Helvetica')
      .text(`${this.formatDate(mealPlan.start_date)} - ${this.formatDate(mealPlan.end_date)}`, { align: 'center' });
    doc.moveDown(1);

    // Balance Metrics Section
    if (mealPlan.balance_metrics) {
      const metrics = JSON.parse(mealPlan.balance_metrics);

      doc.fontSize(16).font('Helvetica-Bold').text('Balance Metrics', { underline: true });
      doc.moveDown(0.5);

      const metricLabels = {
        proteinVariety: 'Protein Variety',
        cookingMethodVariety: 'Cooking Variety',
        doshaBalance: 'Dosha Balance',
        culturalAuthenticity: 'Cultural Authenticity',
        nutritionalBalance: 'Nutritional Balance'
      };

      Object.entries(metrics).forEach(([key, value]: [string, any]) => {
        if (metricLabels[key as keyof typeof metricLabels]) {
          const percentage = Math.round(value * 100);
          const bar = '█'.repeat(Math.floor(percentage / 5)) + '░'.repeat(20 - Math.floor(percentage / 5));

          doc.fontSize(11).font('Helvetica')
            .text(`${metricLabels[key as keyof typeof metricLabels]}: ${percentage}%  ${bar}`);
        }
      });

      doc.moveDown(1.5);
    }

    // Meal Schedule Section
    doc.fontSize(16).font('Helvetica-Bold').text('Meal Schedule', { underline: true });
    doc.moveDown(0.5);

    // Group meals by date
    const mealsByDate: { [key: string]: any[] } = {};
    mealPlan.items.forEach((item: any) => {
      if (!mealsByDate[item.date]) {
        mealsByDate[item.date] = [];
      }
      mealsByDate[item.date].push(item);
    });

    // Render each day
    Object.keys(mealsByDate).sort().forEach((date) => {
      const meals = mealsByDate[date];

      // Day header
      const dayDate = new Date(date + 'T00:00:00');
      const dayName = dayDate.toLocaleDateString('en-US', { weekday: 'long' });

      doc.fontSize(14).font('Helvetica-Bold')
        .text(`${dayName}, ${this.formatDate(date)}`, { underline: true });
      doc.moveDown(0.3);

      // Render meals for this day
      meals.forEach((meal: any) => {
        const recipe = recipeMap[meal.recipe_id];

        doc.fontSize(11).font('Helvetica-Bold')
          .text(`  ${this.capitalize(meal.meal_type)}: `, { continued: true })
          .font('Helvetica')
          .text(recipe?.title || 'Unknown Recipe');

        if (recipe) {
          const totalTime = recipe.prep_time_minutes + recipe.cook_time_minutes;
          doc.fontSize(9).font('Helvetica')
            .text(`    ⏱ ${totalTime} min  •  🍽 ${meal.servings} servings`, { indent: 10 });
        }

        doc.moveDown(0.3);
      });

      doc.moveDown(0.5);

      // Add page break if needed
      if (doc.y > 650) {
        doc.addPage();
      }
    });

    // Shopping List Section
    doc.addPage();
    doc.fontSize(16).font('Helvetica-Bold').text('Shopping List', { underline: true });
    doc.moveDown(0.5);

    const shoppingList = await this.generateShoppingList(mealPlan.items, recipeMap);

    // Group by retailer
    const groupedByRetailer = this.groupIngredientsByRetailer(shoppingList);

    Object.entries(groupedByRetailer).forEach(([retailer, ingredients]: [string, any]) => {
      doc.fontSize(13).font('Helvetica-Bold')
        .text(this.capitalize(retailer.replace(/_/g, ' ')), { underline: true });
      doc.moveDown(0.3);

      ingredients.forEach((ingredient: any) => {
        doc.fontSize(10).font('Helvetica')
          .text(`  • ${ingredient.name} - ${ingredient.quantity} ${ingredient.unit}`);
      });

      doc.moveDown(0.8);
    });

    // Footer
    doc.fontSize(8).font('Helvetica')
      .text(`Generated by Cultural Diet on ${new Date().toLocaleDateString()}`,
        50, doc.page.height - 50, { align: 'center' });
  }

  /**
   * Helper: Generate shopping list from meal plan items
   */
  private async generateShoppingList(items: any[], recipeMap: any): Promise<any[]> {
    const ingredientMap: { [key: string]: any } = {};

    items.forEach((item: any) => {
      const recipe = recipeMap[item.recipe_id];
      if (!recipe || !recipe.ingredients) return;

      const ingredients = JSON.parse(recipe.ingredients);

      ingredients.forEach((ingredient: any) => {
        const key = ingredient.name.toLowerCase();

        if (ingredientMap[key]) {
          // Aggregate quantities (simplified - assume same units)
          ingredientMap[key].quantity += this.parseQuantity(ingredient.quantity) * item.servings / recipe.servings;
        } else {
          ingredientMap[key] = {
            name: ingredient.name,
            quantity: this.parseQuantity(ingredient.quantity) * item.servings / recipe.servings,
            unit: ingredient.unit || '',
            category: this.categorizeIngredient(ingredient.name)
          };
        }
      });
    });

    return Object.values(ingredientMap);
  }

  /**
   * Helper: Group ingredients by retailer preference
   */
  private groupIngredientsByRetailer(ingredients: any[]): { [key: string]: any[] } {
    const groups: { [key: string]: any[] } = {
      patel_brothers: [],
      trader_joes: [],
      costco: [],
      walmart: []
    };

    ingredients.forEach((ingredient: any) => {
      // Simple categorization logic
      if (ingredient.category === 'spices' || ingredient.category === 'indian') {
        groups.patel_brothers.push(ingredient);
      } else if (ingredient.category === 'specialty') {
        groups.trader_joes.push(ingredient);
      } else if (ingredient.category === 'bulk') {
        groups.costco.push(ingredient);
      } else {
        groups.walmart.push(ingredient);
      }
    });

    // Remove empty groups
    Object.keys(groups).forEach(key => {
      if (groups[key].length === 0) {
        delete groups[key];
      }
    });

    return groups;
  }

  /**
   * Helper: Categorize ingredient
   */
  private categorizeIngredient(name: string): string {
    const lowerName = name.toLowerCase();

    if (lowerName.includes('curry') || lowerName.includes('masala') ||
        lowerName.includes('cumin') || lowerName.includes('turmeric') ||
        lowerName.includes('coriander') || lowerName.includes('cardamom')) {
      return 'indian';
    }

    if (lowerName.includes('rice') || lowerName.includes('flour') ||
        lowerName.includes('oil') || lowerName.includes('sugar')) {
      return 'bulk';
    }

    if (lowerName.includes('organic') || lowerName.includes('specialty')) {
      return 'specialty';
    }

    return 'general';
  }

  /**
   * Helper: Parse quantity string to number
   */
  private parseQuantity(quantity: string): number {
    // Simple parsing - extract first number
    const match = quantity.match(/[\d.]+/);
    return match ? parseFloat(match[0]) : 1;
  }

  /**
   * Helper: Get recipes by IDs
   */
  private async getRecipesByIds(ids: number[]): Promise<any[]> {
    if (ids.length === 0) return [];

    const placeholders = ids.map(() => '?').join(',');
    const sql = `SELECT * FROM recipes WHERE id IN (${placeholders})`;

    return await db.all(sql, ids);
  }

  /**
   * Helper: Format date
   */
  private formatDate(dateString: string): string {
    const date = new Date(dateString + 'T00:00:00');
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  }

  /**
   * Helper: Capitalize string
   */
  private capitalize(str: string): string {
    return str.charAt(0).toUpperCase() + str.slice(1);
  }
}

// Export singleton instance
export const shareController = new ShareController();
