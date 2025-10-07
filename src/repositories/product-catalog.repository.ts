import { BaseRepository } from './base.repository';
import { ProductCatalogItem, Retailer } from '../types';

export class ProductCatalogRepository extends BaseRepository<ProductCatalogItem> {
  protected tableName = 'product_catalog';

  async findByRetailer(retailer: Retailer, limit: number = 50, offset: number = 0): Promise<ProductCatalogItem[]> {
    const query = `
      SELECT * FROM product_catalog
      WHERE retailer = ?
      ORDER BY name ASC
      LIMIT ? OFFSET ?
    `;
    return this.db.all<ProductCatalogItem>(query, [retailer, limit, offset]);
  }

  async findByCategory(category: string, retailer?: Retailer, limit: number = 50, offset: number = 0): Promise<ProductCatalogItem[]> {
    let query = `
      SELECT * FROM product_catalog
      WHERE category = ?
    `;
    const params: any[] = [category];

    if (retailer) {
      query += ' AND retailer = ?';
      params.push(retailer);
    }

    query += ' ORDER BY name ASC LIMIT ? OFFSET ?';
    params.push(limit, offset);

    return this.db.all<ProductCatalogItem>(query, params);
  }

  async searchByName(searchTerm: string, retailer?: Retailer, limit: number = 50, offset: number = 0): Promise<ProductCatalogItem[]> {
    let query = `
      SELECT * FROM product_catalog
      WHERE name LIKE ?
    `;
    const params: any[] = [`%${searchTerm}%`];

    if (retailer) {
      query += ' AND retailer = ?';
      params.push(retailer);
    }

    query += ' ORDER BY name ASC LIMIT ? OFFSET ?';
    params.push(limit, offset);

    return this.db.all<ProductCatalogItem>(query, params);
  }

  async findByCulturalTags(tags: string[], retailer?: Retailer, limit: number = 50, offset: number = 0): Promise<ProductCatalogItem[]> {
    // Build WHERE clause for tag search
    const tagConditions = tags.map(() => 'json_extract(cultural_tags, "$") LIKE ?').join(' OR ');

    let query = `
      SELECT * FROM product_catalog
      WHERE (${tagConditions})
    `;
    const params: any[] = tags.map(tag => `%"${tag}"%`);

    if (retailer) {
      query += ' AND retailer = ?';
      params.push(retailer);
    }

    query += ' ORDER BY name ASC LIMIT ? OFFSET ?';
    params.push(limit, offset);

    return this.db.all<ProductCatalogItem>(query, params);
  }

  async findBySKU(retailer: Retailer, sku: string): Promise<ProductCatalogItem | null> {
    const query = 'SELECT * FROM product_catalog WHERE retailer = ? AND sku = ?';
    const row = await this.db.get<ProductCatalogItem>(query, [retailer, sku]);
    return row || null;
  }

  async findByBrand(brand: string, retailer?: Retailer, limit: number = 50, offset: number = 0): Promise<ProductCatalogItem[]> {
    let query = `
      SELECT * FROM product_catalog
      WHERE brand LIKE ?
    `;
    const params: any[] = [`%${brand}%`];

    if (retailer) {
      query += ' AND retailer = ?';
      params.push(retailer);
    }

    query += ' ORDER BY name ASC LIMIT ? OFFSET ?';
    params.push(limit, offset);

    return this.db.all<ProductCatalogItem>(query, params);
  }

  async findByDietaryCertifications(certifications: string[], retailer?: Retailer, limit: number = 50, offset: number = 0): Promise<ProductCatalogItem[]> {
    const certConditions = certifications.map(() => 'json_extract(dietary_certifications, "$") LIKE ?').join(' OR ');

    let query = `
      SELECT * FROM product_catalog
      WHERE diet certifications IS NOT NULL AND (${certConditions})
    `;
    const params: any[] = certifications.map(cert => `%"${cert}"%`);

    if (retailer) {
      query += ' AND retailer = ?';
      params.push(retailer);
    }

    query += ' ORDER BY name ASC LIMIT ? OFFSET ?';
    params.push(limit, offset);

    return this.db.all<ProductCatalogItem>(query, params);
  }

  async findByAyurvedicProperties(properties: string[], retailer?: Retailer, limit: number = 50, offset: number = 0): Promise<ProductCatalogItem[]> {
    const propConditions = properties.map(() => 'json_extract(ayurvedic_properties, "$") LIKE ?').join(' OR ');

    let query = `
      SELECT * FROM product_catalog
      WHERE ayurvedic_properties IS NOT NULL AND (${propConditions})
    `;
    const params: any[] = properties.map(prop => `%"${prop}"%`);

    if (retailer) {
      query += ' AND retailer = ?';
      params.push(retailer);
    }

    query += ' ORDER BY name ASC LIMIT ? OFFSET ?';
    params.push(limit, offset);

    return this.db.all<ProductCatalogItem>(query, params);
  }

  async priceComparison(productName: string, limit: number = 10): Promise<ProductCatalogItem[]> {
    const query = `
      SELECT * FROM product_catalog
      WHERE (name LIKE ? OR cultural_equivalent LIKE ?)
      ORDER BY price ASC
      LIMIT ?
    `;
    const likePattern = `%${productName}%`;
    return this.db.all<ProductCatalogItem>(query, [likePattern, likePattern, limit]);
  }

  async findAlternatives(productId: number, limit: number = 10): Promise<ProductCatalogItem[]> {
    const product = await this.findById(productId);
    if (!product) return [];

    const query = `
      SELECT * FROM product_catalog
      WHERE category = ?
      AND id != ?
      AND (cultural_tags LIKE ? OR cultural_equivalent LIKE ?)
      ORDER BY price ASC
      LIMIT ?
    `;

    const culturalPattern = `%"${product.cultural_tags[0]}"%`;
    return this.db.all<ProductCatalogItem>(query, [
      product.category,
      productId,
      culturalPattern,
      culturalPattern,
      limit
    ]);
  }

  async getRetailerStats(): Promise<Array<{ retailer: Retailer; productCount: number; avgPrice: number }>> {
    const query = `
      SELECT
        retailer,
        COUNT(*) as productCount,
        AVG(price) as avgPrice
      FROM product_catalog
      GROUP BY retailer
      ORDER BY productCount DESC
    `;
    return this.db.all(query);
  }

  async createProduct(product: Omit<ProductCatalogItem, 'id' | 'created_at' | 'updated_at'>): Promise<number> {
    const query = `
      INSERT INTO product_catalog (
        retailer, sku, name, category, subcategory, brand,
        cultural_tags, dietary_certifications, size, price, currency,
        cultural_equivalent, ayurvedic_properties
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    const params = [
      product.retailer,
      product.sku,
      product.name,
      product.category,
      product.subcategory,
      product.brand,
      JSON.stringify(product.cultural_tags),
      JSON.stringify(product.dietary_certifications),
      product.size,
      product.price,
      product.currency,
      JSON.stringify(product.cultural_equivalent),
      JSON.stringify(product.ayurvedic_properties)
    ];

    const result = await this.db.run(query, params);
    return result.lastID || 0;
  }

  async updateProduct(productId: number, product: Partial<ProductCatalogItem>): Promise<boolean> {
    const updates: string[] = [];
    const params: any[] = [];

    const fieldMappings: { [key: string]: string } = {
      retailer: 'retailer',
      sku: 'sku',
      name: 'name',
      category: 'category',
      subcategory: 'subcategory',
      brand: 'brand',
      cultural_tags: 'cultural_tags',
      dietary_certifications: 'dietary_certifications',
      size: 'size',
      price: 'price',
      currency: 'currency',
      cultural_equivalent: 'cultural_equivalent',
      ayurvedic_properties: 'ayurvedic_properties'
    };

    for (const [key, field] of Object.entries(fieldMappings)) {
      if (key in product && product[key as keyof ProductCatalogItem] !== undefined) {
        const value = product[key as keyof ProductCatalogItem];
        if (Array.isArray(value)) {
          updates.push(`${field} = ?`);
          params.push(JSON.stringify(value));
        } else {
          updates.push(`${field} = ?`);
          params.push(value);
        }
      }
    }

    if (updates.length === 0) {
      return false;
    }

    updates.push('updated_at = CURRENT_TIMESTAMP');
    params.push(productId);

    const query = `UPDATE product_catalog SET ${updates.join(', ')} WHERE id = ?`;
    const result = await this.db.run(query, params);

    return (result.changes || 0) > 0;
  }
}