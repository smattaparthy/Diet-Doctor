import { Request, Response } from 'express';
import { UserRepository } from '../repositories';
import { AuthService } from '../utils/auth';
import { ValidationError, ConflictError, NotFoundError } from '../utils/errors';
import { CreateUserRequest, UpdateUserRequest } from '../types';

export class UserController {
  private userRepo: UserRepository;

  constructor() {
    this.userRepo = new UserRepository();
  }

  /**
   * Parse JSON string fields in user object to proper arrays
   */
  private parseUserJsonFields(user: any): any {
    const parsed = { ...user };

    // Parse cuisine_preferences if it's a string
    if (parsed.cuisine_preferences && typeof parsed.cuisine_preferences === 'string') {
      try {
        parsed.cuisine_preferences = JSON.parse(parsed.cuisine_preferences);
      } catch (error) {
        console.error('Failed to parse cuisine_preferences:', error);
        parsed.cuisine_preferences = [];
      }
    }

    // Parse dietary_restrictions if it's a string
    if (parsed.dietary_restrictions && typeof parsed.dietary_restrictions === 'string') {
      try {
        parsed.dietary_restrictions = JSON.parse(parsed.dietary_restrictions);
      } catch (error) {
        console.error('Failed to parse dietary_restrictions:', error);
        parsed.dietary_restrictions = [];
      }
    }

    return parsed;
  }

  register = async (req: Request, res: Response) => {
    try {
      const userData: CreateUserRequest = req.body;

      // Check if user already exists
      const existingUser = await this.userRepo.findByEmail(userData.email);
      if (existingUser) {
        throw new ConflictError('User with this email already exists');
      }

      // Hash password
      const passwordHash = await AuthService.hashPassword(userData.password);
      const userToCreate = { ...userData, password: passwordHash };

      // Create user
      const userId = await this.userRepo.create(userToCreate);

      // Get created user (without password)
      const createdUser = await this.userRepo.findById(userId);
      if (!createdUser) {
        throw new Error('Failed to retrieve created user');
      }

      // Generate JWT token
      const token = AuthService.generateToken({
        userId: createdUser.id,
        email: createdUser.email
      });

      // Remove password hash from response and parse JSON fields
      const { password_hash, ...userResponse } = this.parseUserJsonFields(createdUser);

      return res.status(201).json({
        success: true,
        data: {
          user: userResponse,
          token
        },
        message: 'User registered successfully'
      });
    } catch (error) {
      if (error instanceof ConflictError || error instanceof ValidationError) {
        return res.status(error.statusCode).json({
          success: false,
          error: error.message,
          code: error.code
        });
      }

      console.error('Registration error:', error);
      return res.status(500).json({
        success: false,
        error: 'Registration failed',
        code: 'REGISTRATION_ERROR'
      });
    }
  };

  login = async (req: Request, res: Response) => {
    try {
      const { email, password } = req.body;

      // Find user by email
      const user = await this.userRepo.findByEmail(email);
      if (!user || !user.password_hash) {
        return res.status(401).json({
          success: false,
          error: 'Invalid email or password',
          code: 'INVALID_CREDENTIALS'
        });
      }

      // Verify password
      const isValidPassword = await AuthService.comparePassword(password, user.password_hash);
      if (!isValidPassword) {
        return res.status(401).json({
          success: false,
          error: 'Invalid email or password',
          code: 'INVALID_CREDENTIALS'
        });
      }

      // Generate JWT token
      const token = AuthService.generateToken({
        userId: user.id,
        email: user.email
      });

      // Remove password hash from response and parse JSON fields
      const { password_hash, ...userResponse } = this.parseUserJsonFields(user);

      return res.json({
        success: true,
        data: {
          user: userResponse,
          token
        },
        message: 'Login successful'
      });
    } catch (error) {
      console.error('Login error:', error);
      return res.status(500).json({
        success: false,
        error: 'Login failed',
        code: 'LOGIN_ERROR'
      });
    }
  };

  getProfile = async (req: Request, res: Response) => {
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          error: 'User not authenticated',
          code: 'NOT_AUTHENTICATED'
        });
      }

      const user = await this.userRepo.findById(req.user.id);
      if (!user) {
        throw new NotFoundError('User');
      }

      // Remove password hash from response and parse JSON fields
      const { password_hash, ...userResponse } = this.parseUserJsonFields(user);

      // Get additional user stats
      const stats = await this.userRepo.getUserStats(user.id);

      return res.json({
        success: true,
        data: {
          user: userResponse,
          stats
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

      console.error('Get profile error:', error);
      return res.status(500).json({
        success: false,
        error: 'Failed to retrieve profile',
        code: 'PROFILE_ERROR'
      });
    }
  };

  updateProfile = async (req: Request, res: Response) => {
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          error: 'User not authenticated',
          code: 'NOT_AUTHENTICATED'
        });
      }

      const updateData: UpdateUserRequest = req.body;

      const success = await this.userRepo.updateProfile(req.user.id, updateData);
      if (!success) {
        throw new Error('Failed to update profile');
      }

      // Get updated user
      const updatedUser = await this.userRepo.findById(req.user.id);
      if (!updatedUser) {
        throw new NotFoundError('User');
      }

      // Remove password hash from response and parse JSON fields
      const { password_hash, ...userResponse } = this.parseUserJsonFields(updatedUser);

      return res.json({
        success: true,
        data: userResponse,
        message: 'Profile updated successfully'
      });
    } catch (error) {
      if (error instanceof NotFoundError) {
        return res.status(404).json({
          success: false,
          error: error.message,
          code: error.code
        });
      }

      console.error('Update profile error:', error);
      return res.status(500).json({
        success: false,
        error: 'Failed to update profile',
        code: 'UPDATE_ERROR'
      });
    }
  };

  changePassword = async (req: Request, res: Response) => {
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          error: 'User not authenticated',
          code: 'NOT_AUTHENTICATED'
        });
      }

      const { currentPassword, newPassword } = req.body;

      // Get current user with password
      const user = await this.userRepo.findByEmail(req.user.email);
      if (!user || !user.password_hash) {
        return res.status(401).json({
          success: false,
          error: 'User not found',
          code: 'USER_NOT_FOUND'
        });
      }

      // Verify current password
      const isValidPassword = await AuthService.comparePassword(currentPassword, user.password_hash);
      if (!isValidPassword) {
        return res.status(401).json({
          success: false,
          error: 'Current password is incorrect',
          code: 'INVALID_PASSWORD'
        });
      }

      // Validate new password strength
      const passwordValidation = AuthService.validatePasswordStrength(newPassword);
      if (!passwordValidation.isValid) {
        return res.status(400).json({
          success: false,
          error: 'New password does not meet requirements',
          code: 'WEAK_PASSWORD',
          details: passwordValidation.errors
        });
      }

      // Hash new password
      const newPasswordHash = await AuthService.hashPassword(newPassword);

      // Update password
      const success = await this.userRepo.updatePassword(user.id, newPasswordHash);
      if (!success) {
        throw new Error('Failed to update password');
      }

      return res.json({
        success: true,
        message: 'Password changed successfully'
      });
    } catch (error) {
      console.error('Change password error:', error);
      return res.status(500).json({
        success: false,
        error: 'Failed to change password',
        code: 'PASSWORD_CHANGE_ERROR'
      });
    }
  };

  deleteAccount = async (req: Request, res: Response) => {
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          error: 'User not authenticated',
          code: 'NOT_AUTHENTICATED'
        });
      }

      const { password } = req.body;

      // Get current user with password
      const user = await this.userRepo.findByEmail(req.user.email);
      if (!user || !user.password_hash) {
        return res.status(401).json({
          success: false,
          error: 'User not found',
          code: 'USER_NOT_FOUND'
        });
      }

      // Verify password
      const isValidPassword = await AuthService.comparePassword(password, user.password_hash);
      if (!isValidPassword) {
        return res.status(401).json({
          success: false,
          error: 'Password is incorrect',
          code: 'INVALID_PASSWORD'
        });
      }

      // Delete user (cascade delete will handle related records)
      const success = await this.userRepo.delete(user.id);
      if (!success) {
        throw new Error('Failed to delete account');
      }

      return res.json({
        success: true,
        message: 'Account deleted successfully'
      });
    } catch (error) {
      console.error('Delete account error:', error);
      return res.status(500).json({
        success: false,
        error: 'Failed to delete account',
        code: 'DELETE_ACCOUNT_ERROR'
      });
    }
  };

  refreshToken = async (req: Request, res: Response) => {
    try {
      const { token } = req.body;

      if (!token) {
        return res.status(401).json({
          success: false,
          error: 'Token is required',
          code: 'TOKEN_REQUIRED'
        });
      }

      const newToken = AuthService.refreshToken(token);

      return res.json({
        success: true,
        data: { token: newToken },
        message: 'Token refreshed successfully'
      });
    } catch (error) {
      return res.status(401).json({
        success: false,
        error: 'Token refresh failed',
        code: 'TOKEN_REFRESH_FAILED'
      });
    }
  };
}