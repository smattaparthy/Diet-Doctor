import { BaseRepository } from './base.repository';
import { ShoppingList, ShoppingListItem, RetailerGroup } from '../types';

export class ShoppingListRepository extends BaseRepository<ShoppingList> {
  protected tableName = 'shopping_lists';

  async findByUserId(userId: number, limit: number = 20, offset: number = 0): Promise<ShoppingList[]> {
    const query = `
      SELECT * FROM shopping_lists
      WHERE user_id = ?
      ORDER BY updated_at DESC
      LIMIT ? OFFSET ?
    `;
    return this.db.all<ShoppingList>(query, [userId, limit, offset]);
  }

  async findByName(userId: number, name: string): Promise<ShoppingList | null> {
    const query = 'SELECT * FROM shopping_lists WHERE user_id = ? AND name = ?';
    const row = await this.db.get<ShoppingList>(query, [userId, name]);
    return row || null;
  }

  async createShoppingList(shoppingList: Omit<ShoppingList, 'id' | 'created_at' | 'updated_at'>): Promise<number> {
    const query = `
      INSERT INTO shopping_lists (user_id, name, items, retailer_groups)
      VALUES (?, ?, ?, ?)
    `;

    const params = [
      shoppingList.user_id,
      shoppingList.name,
      JSON.stringify(shoppingList.items),
      JSON.stringify(shoppingList.retailer_groups)
    ];

    const result = await this.db.run(query, params);
    return result.lastID || 0;
  }

  async updateShoppingList(listId: number, updateData: {
    name?: string;
    items?: ShoppingListItem[];
    retailer_groups?: RetailerGroup[];
  }): Promise<boolean> {
    const updates: string[] = [];
    const params: any[] = [];

    if (updateData.name !== undefined) {
      updates.push('name = ?');
      params.push(updateData.name);
    }

    if (updateData.items !== undefined) {
      updates.push('items = ?');
      params.push(JSON.stringify(updateData.items));
    }

    if (updateData.retailer_groups !== undefined) {
      updates.push('retailer_groups = ?');
      params.push(JSON.stringify(updateData.retailer_groups));
    }

    if (updates.length === 0) {
      return false;
    }

    updates.push('updated_at = CURRENT_TIMESTAMP');
    params.push(listId);

    const query = `UPDATE shopping_lists SET ${updates.join(', ')} WHERE id = ?`;
    const result = await this.db.run(query, params);

    return (result.changes || 0) > 0;
  }

  async addItemToList(listId: number, item: Omit<ShoppingListItem, 'id'>): Promise<boolean> {
    const existingList = await this.findById(listId);
    if (!existingList) {
      return false;
    }

    // Add the new item to the items array
    const newItems = [
      ...existingList.items,
      { ...item, id: Date.now() } // Generate a temporary ID
    ];

    return this.updateShoppingList(listId, { items: newItems });
  }

  async removeItemFromList(listId: number, itemId: number): Promise<boolean> {
    const existingList = await this.findById(listId);
    if (!existingList) {
      return false;
    }

    // Remove the item from the items array
    const newItems = existingList.items.filter(item => item.id !== itemId);

    return this.updateShoppingList(listId, { items: newItems });
  }

  async updateItemStatus(listId: number, itemId: number, purchased: boolean): Promise<boolean> {
    const existingList = await this.findById(listId);
    if (!existingList) {
      return false;
    }

    // Update the purchased status of the specific item
    const newItems = existingList.items.map(item =>
      item.id === itemId ? { ...item, purchased } : item
    );

    return this.updateShoppingList(listId, { items: newItems });
  }

  async generateFromMealPlan(userId: number, _mealPlanId: number, name: string): Promise<number | null> {
    // This would involve getting the meal plan, finding products for the recipes,
    // and organizing them by retailer. For now, create a basic structure

    const basicList: Omit<ShoppingList, 'id' | 'created_at' | 'updated_at'> = {
      user_id: userId,
      name: name,
      items: [], // Would be populated based on meal plan recipes
      retailer_groups: [] // Would be organized by retailer
    };

    return this.createShoppingList(basicList);
  }

  async optimizeShoppingList(listId: number): Promise<ShoppingList | null> {
    const existingList = await this.findById(listId);
    if (!existingList) {
      return null;
    }

    // Optimization logic would go here:
    // - Group items by retailer
    // - Find alternatives for missing items
    // - Apply discount opportunities
    // - Minimize number of stores visited

    return existingList; // Return optimized list
  }

  async getUserShoppingStats(userId: number): Promise<{
    totalLists: number;
    activeLists: number;
    totalItems: number;
    completedItems: number;
    averageCompletionRate: number;
  }> {
    const lists = await this.findByUserId(userId, 100); // Get all lists for stats

    if (lists.length === 0) {
      return {
        totalLists: 0,
        activeLists: 0,
        totalItems: 0,
        completedItems: 0,
        averageCompletionRate: 0
      };
    }

    let totalItems = 0;
    let completedItems = 0;
    let activeLists = 0;

    lists.forEach(list => {
      const items = list.items.length;
      const completed = list.items.filter(item => item.purchased).length;
      const completionRate = items > 0 ? completed / items : 0;

      totalItems += items;
      completedItems += completed;

      // Consider a list active if completion rate is less than 90%
      if (completionRate < 0.9) {
        activeLists++;
      }
    });

    return {
      totalLists: lists.length,
      activeLists,
      totalItems,
      completedItems,
      averageCompletionRate: totalItems > 0 ? completedItems / totalItems : 0
    };
  }

  async findDuplicateItems(userId: number): Promise<Array<{
    product_sku: string;
    item_names: string[];
    list_names: string[];
    total_quantity: number;
  }>> {
    const lists = await this.findByUserId(userId, 100);
    const itemMap = new Map<string, {
      item_names: string[];
      list_names: string[];
      total_quantity: number;
    }>();

    lists.forEach(list => {
      list.items.forEach(item => {
        const key = item.product_sku;
        if (!item.purchased) { // Only consider unpurchased items
          if (itemMap.has(key)) {
            const existing = itemMap.get(key)!;
            existing.item_names.push(item.product_sku);
            existing.list_names.push(list.name);
            existing.total_quantity += item.quantity;
          } else {
            itemMap.set(key, {
              item_names: [item.product_sku],
              list_names: [list.name],
              total_quantity: item.quantity
            });
          }
        }
      });
    });

    // Return items that appear in multiple lists or are in the same list multiple times
    return Array.from(itemMap.entries())
      .filter(([_key, value]) => value.item_names.length > 1 || value.total_quantity > 1)
      .map(([product_sku, data]) => ({
        product_sku,
        item_names: data.item_names,
        list_names: data.list_names,
        total_quantity: data.total_quantity
      }));
  }

  async consolidateItems(userId: number, fromListIds: number[], targetListName: string): Promise<number | null> {
    const fromLists = await Promise.all(
      fromListIds.map(id => this.findById(id))
    );

    const validLists = fromLists.filter(list => list && list.user_id === userId);
    if (validLists.length === 0) {
      return null;
    }

    // Combine all items from source lists
    const allItems = validLists.reduce((acc, list) => {
      if (list) {
        acc.push(...list.items);
      }
      return acc;
    }, [] as ShoppingListItem[]);

    // Create or find target list
    let targetList = await this.findByName(userId, targetListName);
    if (!targetList) {
      const newListId = await this.createShoppingList({
        user_id: userId,
        name: targetListName,
        items: allItems,
        retailer_groups: []
      });
      return newListId;
    } else {
      // Add items to existing list
      const updatedItems = [...targetList.items, ...allItems];
      await this.updateShoppingList(targetList.id, { items: updatedItems });
      return targetList.id;
    }
  }

  async deleteShoppingList(listId: number): Promise<boolean> {
    return this.delete(listId);
  }
}