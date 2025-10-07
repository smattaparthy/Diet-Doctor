import { Request, Response } from 'express';
import { ProductCatalogRepository } from '../repositories';
import { ProductCatalogItem, ProductCatalogItemRow, Retailer } from '../types';
import { NotFoundError } from '../utils/errors';

export class ProductCatalogController {
  private productRepo: ProductCatalogRepository;

  constructor() {
    this.productRepo = new ProductCatalogRepository();
  }

  searchProducts = async (req: Request, res: Response) => {
    try {
      const {
        searchTerm,
        retailer,
        category,
        brand,
        cultural_tags,
        dietary_certifications,
        ayurvedic_properties,
        max_price,
        page = 1,
        limit = 20
      } = req.query;

      const offset = (parseInt(page as string) - 1) * parseInt(limit as string);
      let products: ProductCatalogItem[] = [];

      // Search logic based on provided parameters
      if (searchTerm) {
        products = await this.productRepo.searchByName(
          searchTerm as string,
          retailer as Retailer,
          parseInt(limit as string),
          offset
        );
      } else if (category) {
        products = await this.productRepo.findByCategory(
          category as string,
          retailer as Retailer,
          parseInt(limit as string),
          offset
        );
      } else if (brand) {
        products = await this.productRepo.findByBrand(
          brand as string,
          retailer as Retailer,
          parseInt(limit as string),
          offset
        );
      } else if (cultural_tags) {
        const tagArray = Array.isArray(cultural_tags)
          ? cultural_tags as string[]
          : [cultural_tags as string];
        products = await this.productRepo.findByCulturalTags(
          tagArray,
          retailer as Retailer,
          parseInt(limit as string),
          offset
        );
      } else if (dietary_certifications) {
        const certArray = Array.isArray(dietary_certifications)
          ? dietary_certifications as string[]
          : [dietary_certifications as string];
        products = await this.productRepo.findByDietaryCertifications(
          certArray,
          retailer as Retailer,
          parseInt(limit as string),
          offset
        );
      } else if (ayurvedic_properties) {
        const propArray = Array.isArray(ayurvedic_properties)
          ? ayurvedic_properties as string[]
          : [ayurvedic_properties as string];
        products = await this.productRepo.findByAyurvedicProperties(
          propArray,
          retailer as Retailer,
          parseInt(limit as string),
          offset
        );
      } else {
        // Default: get all products with filtering
        products = retailer
          ? await this.productRepo.findByRetailer(
              retailer as Retailer,
              parseInt(limit as string),
              offset
            )
          : await this.productRepo.findAll(
              parseInt(limit as string),
              offset
            );
      }

      // Filter by price if specified
      let filteredProducts = products;
      if (max_price) {
        filteredProducts = products.filter(product => product.price <= parseFloat(max_price as string));
      }

      // Get total count for pagination
      let total = 0;
      if (searchTerm) {
        const allProducts = await this.productRepo.searchByName(searchTerm as string, retailer as Retailer, 1000, 0);
        total = max_price ? allProducts.filter(p => p.price <= parseFloat(max_price as string)).length : allProducts.length;
      } else if (category) {
        const allProducts = await this.productRepo.findByCategory(category as string, retailer as Retailer, 1000, 0);
        total = max_price ? allProducts.filter(p => p.price <= parseFloat(max_price as string)).length : allProducts.length;
      } else if (retailer) {
        const allProducts = await this.productRepo.findByRetailer(retailer as Retailer, 1000, 0);
        total = max_price ? allProducts.filter(p => p.price <= parseFloat(max_price as string)).length : allProducts.length;
      } else {
        total = await this.productRepo.count();
        if (max_price) {
          const allProducts = await this.productRepo.findAll(1000, 0);
          total = allProducts.filter(p => p.price <= parseFloat(max_price as string)).length;
        }
      }

      return res.json({
        success: true,
        data: filteredProducts.map((productRow) => {
          const row = productRow as any as ProductCatalogItemRow;
          const product: ProductCatalogItem = {
            ...row,
            cultural_tags: JSON.parse(row.cultural_tags),
            dietary_certifications: JSON.parse(row.dietary_certifications),
            cultural_equivalent: JSON.parse(row.cultural_equivalent),
            ayurvedic_properties: row.ayurvedic_properties ? JSON.parse(row.ayurvedic_properties) : undefined
          };
          return product;
        }),
        pagination: {
          page: parseInt(page as string),
          limit: parseInt(limit as string),
          total,
          total_pages: Math.ceil(total / parseInt(limit as string))
        }
      });
    } catch (error) {
      console.error('Product search error:', error);
      return res.status(500).json({
        success: false,
        error: 'Failed to search products',
        code: 'PRODUCT_SEARCH_ERROR'
      });
    }
  };

  getProduct = async (req: Request, res: Response) => {
    try {
      const { retailer, sku } = req.params;

      const product = await this.productRepo.findBySKU(retailer as Retailer, sku);
      if (!product) {
        throw new NotFoundError('Product');
      }

      // Find alternatives
      const alternativesRows = await this.productRepo.findAlternatives(product.id, 5);

      const productRow = product as any as ProductCatalogItemRow;
      const productData: ProductCatalogItem = {
        ...productRow,
        cultural_tags: JSON.parse(productRow.cultural_tags),
        dietary_certifications: JSON.parse(productRow.dietary_certifications),
        cultural_equivalent: JSON.parse(productRow.cultural_equivalent),
        ayurvedic_properties: productRow.ayurvedic_properties ? JSON.parse(productRow.ayurvedic_properties) : undefined
      };

      return res.json({
        success: true,
        data: {
          ...productData,
          alternatives: alternativesRows.map((altRow) => {
            const alt = altRow as any as ProductCatalogItemRow;
            return {
              ...alt,
              cultural_tags: JSON.parse(alt.cultural_tags),
              dietary_certifications: JSON.parse(alt.dietary_certifications),
              cultural_equivalent: JSON.parse(alt.cultural_equivalent),
              ayurvedic_properties: alt.ayurvedic_properties ? JSON.parse(alt.ayurvedic_properties) : undefined
            };
          })
        }
      });
    } catch (error) {
      if (error instanceof NotFoundError) {
        return res.status(404).json({
          success: false,
          error: error.message,
          code: error.code
        });
      }

      console.error('Get product error:', error);
      return res.status(500).json({
        success: false,
        error: 'Failed to retrieve product',
        code: 'GET_PRODUCT_ERROR'
      });
    }
  };

  getRetailers = async (_req: Request, res: Response) => {
    try {
      const retailers = await this.productRepo.getRetailerStats();

      return res.json({
        success: true,
        data: retailers.map(retailer => ({
          retailer: retailer.retailer,
          product_count: retailer.productCount,
          average_price: Math.round(retailer.avgPrice * 100) / 100
        }))
      });
    } catch (error) {
      console.error('Get retailers error:', error);
      return res.status(500).json({
        success: false,
        error: 'Failed to retrieve retailer information',
        code: 'GET_RETAILERS_ERROR'
      });
    }
  };

  getCategories = async (req: Request, res: Response) => {
    try {
      const { retailer } = req.query;

      const categories = retailer
        ? await this.productRepo['db'].all<{ category: string }>(
            'SELECT DISTINCT category FROM product_catalog WHERE retailer = ? ORDER BY category',
            [retailer]
          )
        : await this.productRepo['db'].all<{ category: string }>(
            'SELECT DISTINCT category FROM product_catalog ORDER BY category'
          );

      return res.json({
        success: true,
        data: categories.map((cat: { category: string }) => cat.category)
      });
    } catch (error) {
      console.error('Get categories error:', error);
      return res.status(500).json({
        success: false,
        error: 'Failed to retrieve categories',
        code: 'GET_CATEGORIES_ERROR'
      });
    }
  };

  getBrands = async (req: Request, res: Response) => {
    try {
      const { retailer, category } = req.query;

      let query = 'SELECT DISTINCT brand FROM product_catalog WHERE brand IS NOT NULL AND brand != ""';
      const params: any[] = [];

      if (retailer) {
        query += ' AND retailer = ?';
        params.push(retailer);
      }

      if (category) {
        query += ' AND category = ?';
        params.push(category);
      }

      query += ' ORDER BY brand';

      const brands = await this.productRepo['db'].all<{ brand: string }>(query, params);

      return res.json({
        success: true,
        data: brands.map((brand: { brand: string }) => brand.brand)
      });
    } catch (error) {
      console.error('Get brands error:', error);
      return res.status(500).json({
        success: false,
        error: 'Failed to retrieve brands',
        code: 'GET_BRANDS_ERROR'
      });
    }
  };

  priceComparison = async (req: Request, res: Response) => {
    try {
      const { productName } = req.query;

      if (!productName) {
        return res.status(400).json({
          success: false,
          error: 'Product name is required for price comparison',
          code: 'MISSING_PRODUCT_NAME'
        });
      }

      const products = await this.productRepo.priceComparison(productName as string);

      // Group by retailer and find best price
      const retailerGroups = products.reduce((groups: any, product) => {
        if (!groups[product.retailer]) {
          groups[product.retailer] = {
            retailer: product.retailer,
            products: [],
            best_price: null,
            best_price_product: null
          };
        }

        groups[product.retailer].products.push(product);

        if (!groups[product.retailer].best_price || product.price < groups[product.retailer].best_price) {
          groups[product.retailer].best_price = product.price;
          groups[product.retailer].best_price_product = product;
        }

        return groups;
      }, {});

      // Find overall best price
      const overallBest = products.reduce((best: any, current) =>
        !best || current.price < best.price ? current : best, null
      );

      return res.json({
        success: true,
        data: {
          product_name: productName,
          overall_best_price: overallBest ? {
            price: overallBest.price,
            retailer: overallBest.retailer,
            name: overallBest.name,
            sku: overallBest.sku
          } : null,
          retailer_comparison: Object.values(retailerGroups)
        }
      });
    } catch (error) {
      console.error('Price comparison error:', error);
      return res.status(500).json({
        success: false,
        error: 'Failed to compare prices',
        code: 'PRICE_COMPARISON_ERROR'
      });
    }
  };

  createProduct = async (req: Request, res: Response) => {
    try {
      const productData = req.body;

      const productId = await this.productRepo.createProduct(productData);

      // Get created product
      const createdProduct = await this.productRepo.findById(productId);
      if (!createdProduct) {
        throw new Error('Failed to retrieve created product');
      }

      const createdRow = createdProduct as any as ProductCatalogItemRow;
      const createdData: ProductCatalogItem = {
        ...createdRow,
        cultural_tags: JSON.parse(createdRow.cultural_tags),
        dietary_certifications: JSON.parse(createdRow.dietary_certifications),
        cultural_equivalent: JSON.parse(createdRow.cultural_equivalent),
        ayurvedic_properties: createdRow.ayurvedic_properties ? JSON.parse(createdRow.ayurvedic_properties) : undefined
      };

      return res.status(201).json({
        success: true,
        data: createdData,
        message: 'Product created successfully'
      });
    } catch (error) {
      console.error('Create product error:', error);
      return res.status(500).json({
        success: false,
        error: 'Failed to create product',
        code: 'CREATE_PRODUCT_ERROR'
      });
    }
  };

  updateProduct = async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const updateData = req.body;

      const success = await this.productRepo.updateProduct(parseInt(id), updateData);

      if (success) {
        // Get updated product
        const updatedProduct = await this.productRepo.findById(parseInt(id));
        if (updatedProduct) {
          const updatedRow = updatedProduct as any as ProductCatalogItemRow;
          const updatedData: ProductCatalogItem = {
            ...updatedRow,
            cultural_tags: JSON.parse(updatedRow.cultural_tags),
            dietary_certifications: JSON.parse(updatedRow.dietary_certifications),
            cultural_equivalent: JSON.parse(updatedRow.cultural_equivalent),
            ayurvedic_properties: updatedRow.ayurvedic_properties ? JSON.parse(updatedRow.ayurvedic_properties) : undefined
          };

          return res.json({
            success: true,
            data: updatedData,
            message: 'Product updated successfully'
          });
        }
      }

      return res.status(500).json({
        success: false,
        error: 'Failed to update product',
        code: 'UPDATE_PRODUCT_ERROR'
      });
    } catch (error) {
      console.error('Update product error:', error);
      return res.status(500).json({
        success: false,
        error: 'Failed to update product',
        code: 'UPDATE_PRODUCT_ERROR'
      });
    }
  };

  deleteProduct = async (req: Request, res: Response) => {
    try {
      const { id } = req.params;

      const success = await this.productRepo.delete(parseInt(id));

      return res.json({
        success: success,
        message: success ? 'Product deleted successfully' : 'Product not found'
      });
    } catch (error) {
      console.error('Delete product error:', error);
      return res.status(500).json({
        success: false,
        error: 'Failed to delete product',
        code: 'DELETE_PRODUCT_ERROR'
      });
    }
  };
}