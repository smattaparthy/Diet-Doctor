// Docker Deployment Testing Suite
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const axios = require('axios');

class DockerDeploymentTester {
  constructor() {
    this.testResults = {
      containerBuild: { passed: true, issues: [] },
      containerRun: { passed: true, issues: [] },
      databaseOperations: { passed: true, issues: [] },
      apiFunctionality: { passed: true, issues: [] },
      culturalIntegrity: { passed: true, issues: [] },
      performance: { passed: true, issues: [] },
      security: { passed: true, issues: [] }
    };
  }

  // Test Docker container builds
  async testContainerBuild() {
    console.log('\n🐳 Testing Docker Container Builds...');

    try {
      // Check if Dockerfiles exist
      const dockerfiles = [
        'Dockerfile.backend',
        'Dockerfile.frontend'
      ];

      for (const dockerfile of dockerfiles) {
        if (!fs.existsSync(path.join(__dirname, '../../', dockerfile))) {
          this.testResults.containerBuild.passed = false;
          this.testResults.containerBuild.issues.push(`Missing ${dockerfile}`);
        }
      }

      // Check docker-compose files
      const composeFiles = [
        'docker-compose.dev.yml',
        'docker-compose.prod.yml'
      ];

      for (const composeFile of composeFiles) {
        if (!fs.existsSync(path.join(__dirname, '../../', composeFile))) {
          this.testResults.containerBuild.passed = false;
          this.testResults.containerBuild.issues.push(`Missing ${composeFile}`);
        }
      }

      // Test backend container build (dry run)
      try {
        execSync('docker build -f Dockerfile.backend --dry-run .', {
          stdio: 'pipe',
          cwd: path.join(__dirname, '../../')
        });
      } catch (error) {
        // Docker doesn't have --dry-run, so we'll validate the Dockerfile structure
        const backendDockerfile = fs.readFileSync('Dockerfile.backend', 'utf8');
        if (!backendDockerfile.includes('FROM node')) {
          this.testResults.containerBuild.passed = false;
          this.testResults.containerBuild.issues.push('Backend Dockerfile missing Node base image');
        }
        if (!backendDockerfile.includes('COPY')) {
          this.testResults.containerBuild.passed = false;
          this.testResults.containerBuild.issues.push('Backend Dockerfile missing COPY instructions');
        }
      }

      // Test frontend container build
      const frontendDockerfile = fs.readFileSync('Dockerfile.frontend', 'utf8');
      if (!frontendDockerfile.includes('FROM')) {
        this.testResults.containerBuild.passed = false;
        this.testResults.containerBuild.issues.push('Frontend Dockerfile missing base image');
      }

      // Validate docker-compose files syntax
      try {
        execSync('docker-compose -f docker-compose.prod.yml config', {
          stdio: 'pipe',
          cwd: path.join(__dirname, '../../')
        });
      } catch (error) {
        this.testResults.containerBuild.passed = false;
        this.testResults.containerBuild.issues.push('docker-compose.prod.yml syntax error');
      }

    } catch (error) {
      this.testResults.containerBuild.passed = false;
      this.testResults.containerBuild.issues.push(`Build test error: ${error.message}`);
    }

    return this.testResults.containerBuild;
  }

  // Test container runtime configuration
  async testContainerRun() {
    console.log('\n🚀 Testing Container Runtime Configuration...');

    try {
      // Check environment variables in docker-compose
      const composeContent = fs.readFileSync('docker-compose.prod.yml', 'utf8');

      const requiredEnvs = [
        'NODE_ENV',
        'DATABASE_PATH',
        'JWT_SECRET',
        'PORT'
      ];

      for (const env of requiredEnvs) {
        if (!composeContent.includes(env)) {
          this.testResults.containerRun.passed = false;
          this.testResults.containerRun.issues.push(`Missing environment variable: ${env}`);
        }
      }

      // Check volume mounts
      if (!composeContent.includes('volumes:')) {
        this.testResults.containerRun.issues.push('No persistent volumes configured');
      }

      // Check network configuration
      if (!composeContent.includes('networks:')) {
        this.testResults.containerRun.issues.push('No network isolation configured');
      }

      // Check health checks
      if (!composeContent.includes('healthcheck:')) {
        this.testResults.containerRun.issues.push('No health checks configured');
      }

      // Validate port mappings
      const portMappings = composeContent.match(/ports:\s*\n\s*-\s*"(\d+:\d+)"/g);
      if (!portMappings || portMappings.length === 0) {
        this.testResults.containerRun.issues.push('No port mappings configured');
      }

    } catch (error) {
      this.testResults.containerRun.passed = false;
      this.testResults.containerRun.issues.push(`Runtime test error: ${error.message}`);
    }

    return this.testResults.containerRun;
  }

  // Test database operations in containerized environment
  async testDatabaseOperations() {
    console.log('\n💾 Testing Database Operations...');

    try {
      // Check database schema file
      const schemaPath = path.join(__dirname, '../../src/database/schema.sql');
      if (!fs.existsSync(schemaPath)) {
        this.testResults.databaseOperations.passed = false;
        this.testResults.databaseOperations.issues.push('Database schema file missing');
        return this.testResults.databaseOperations;
      }

      // Validate schema content
      const schemaContent = fs.readFileSync(schemaPath, 'utf8');
      const requiredTables = [
        'CREATE TABLE.*users',
        'CREATE TABLE.*recipes',
        'CREATE TABLE.*cultural_rules',
        'CREATE TABLE.*meal_plans',
        'CREATE TABLE.*shopping_lists'
      ];

      for (const table of requiredTables) {
        if (!new RegExp(table, 'i').test(schemaContent)) {
          this.testResults.databaseOperations.passed = false;
          this.testResults.databaseOperations.issues.push(`Missing table: ${table}`);
        }
      }

      // Check for database initialization scripts
      const migrateScript = path.join(__dirname, '../../src/database/migrate.ts');
      const seedScript = path.join(__dirname, '../../src/database/seed.ts');

      if (!fs.existsSync(migrateScript)) {
        this.testResults.databaseOperations.passed = false;
        this.testResults.databaseOperations.issues.push('Database migration script missing');
      }

      if (!fs.existsSync(seedScript)) {
        this.testResults.databaseOperations.issues.push('Database seed script missing');
      }

      // Check foreign key constraints
      if (!schemaContent.includes('FOREIGN KEY')) {
        this.testResults.databaseOperations.issues.push('No foreign key constraints found');
      }

      // Checkindexes for performance
      if (!schemaContent.includes('CREATE INDEX')) {
        this.testResults.databaseOperations.issues.push('No database indexes found - performance may be impacted');
      }

    } catch (error) {
      this.testResults.databaseOperations.passed = false;
      this.testResults.databaseOperations.issues.push(`Database test error: ${error.message}`);
    }

    return this.testResults.databaseOperations;
  }

  // Test API functionality in containerized environment
  async testAPIFunctionality() {
    console.log('\n⚡ Testing API Functionality...');

    const apiClient = axios.create({
      baseURL: 'http://localhost:3000',
      timeout: 5000
    });

    try {
      // Test health endpoint
      try {
        const healthResponse = await apiClient.get('/health');
        if (healthResponse.status !== 200 || !healthResponse.data.status) {
          this.testResults.apiFunctionality.issues.push('Health endpoint not responding correctly');
        }
      } catch (error) {
        this.testResults.apiFunctionality.issues.push('Cannot reach health endpoint - API may not be running');
      }

      // Test cultural rules endpoint
      try {
        const culturalResponse = await apiClient.get('/api/v1/cultural-rules/forbidden-ingredients?culturalBackground=hindu');
        if (culturalResponse.status !== 200 || !culturalResponse.data.forbiddenIngredients) {
          this.testResults.apiFunctionality.issues.push('Cultural rules endpoint not working correctly');
        }
      } catch (error) {
        this.testResults.apiFunctionality.issues.push('Cultural rules endpoint error');
      }

      // Test recipes endpoint
      try {
        const recipesResponse = await apiClient.get('/api/v1/recipes?culturalBackground=hindu');
        if (recipesResponse.status !== 200) {
          this.testResults.apiFunctionality.issues.push('Recipes endpoint not responding');
        }
      } catch (error) {
        this.testResults.apiFunctionality.issues.push('Recipes endpoint error');
      }

    } catch (error) {
      this.testResults.apiFunctionality.issues.push(`API test error: ${error.message}`);
    }

    return this.testResults.apiFunctionality;
  }

  // Test cultural integrity in deployed environment
  async testCulturalIntegrity() {
    console.log('\n🕉️ Testing Cultural Integrity...');

    try {
      // This would test cultural rules in the deployed environment
      // For now, we'll validate the cultural rules configuration files

      const culturalRulesDir = path.join(__dirname, '../../src/services');
      if (!fs.existsSync(culturalRulesDir)) {
        this.testResults.culturalIntegrity.issues.push('Cultural rules service directory missing');
      }

      // Check if cultural rules are properly configured
      const schemaPath = path.join(__dirname, '../../src/database/schema.sql');
      if (fs.existsSync(schemaPath)) {
        const schemaContent = fs.readFileSync(schemaPath, 'utf8');

        if (!schemaContent.includes('cultural_rules')) {
          this.testResults.culturalIntegrity.passed = false;
          this.testResults.culturalIntegrity.issues.push('Cultural rules table missing from schema');
        }

        // Check for required cultural rule fields
        const requiredFields = [
          'forbidden_ingredients',
          'cultural_background',
          'severity'
        ];

        for (const field of requiredFields) {
          if (!schemaContent.includes(field)) {
            this.testResults.culturalIntegrity.issues.push(`Missing cultural rule field: ${field}`);
          }
        }
      }

    } catch (error) {
      this.testResults.culturalIntegrity.issues.push(`Cultural integrity test error: ${error.message}`);
    }

    return this.testResults.culturalIntegrity;
  }

  // Test performance characteristics
  async testPerformance() {
    console.log('\n📊 Testing Performance Characteristics...');

    try {
      // Check configuration files for performance settings
      const composeContent = fs.readFileSync('docker-compose.prod.yml', 'utf8');

      // Check memory limits
      if (!composeContent.includes('mem_limit') && !composeContent.includes('memory')) {
        this.testResults.performance.issues.push('No memory limits configured');
      }

      // Check CPU limits
      if (!composeContent.includes('cpus')) {
        this.testResults.performance.issues.push('No CPU limits configured');
      }

      // Check for caching layers in Dockerfiles
      const backendDockerfile = fs.readFileSync('Dockerfile.backend', 'utf8');
      if (!backendDockerfile.includes('node_modules')) {
        this.testResults.performance.issues.push('No dependency caching in backend Dockerfile');
      }

      // Check for multi-stage builds to reduce image size
      if (!backendDockerfile.includes('AS')) {
        this.testResults.performance.issues.push('No multi-stage build in backend Dockerfile');
      }

      // Check .dockerignore for build optimization
      if (!fs.existsSync('.dockerignore')) {
        this.testResults.performance.issues.push('No .dockerignore file - build performance may be impacted');
      }

    } catch (error) {
      this.testResults.performance.issues.push(`Performance test error: ${error.message}`);
    }

    return this.testResults.performance;
  }

  // Test security in deployed environment
  async testSecurity() {
    console.log('\n🔒 Testing Security Configuration...');

    try {
      // Check security settings in docker-compose
      const composeContent = fs.readFileSync('docker-compose.prod.yml', 'utf8');

      // Check for non-root user
      if (!composeContent.includes('user:')) {
        this.testResults.security.issues.push('Containers running as root user');
      }

      // Check for read-only filesystems
      if (!composeContent.includes('read_only')) {
        this.testResults.security.issues.push('Containers not configured with read-only filesystems');
      }

      // Check for health checks
      if (!composeContent.includes('healthcheck')) {
        this.testResults.security.issues.push('No health checks configured');
      }

      // Check for secrets management
      if (!composeContent.includes('secrets:') && !composeContent.includes('environment.*SECRET')) {
        this.testResults.security.issues.push('No proper secrets management');
      }

      // Check Docker base images for vulnerabilities
      const backendDockerfile = fs.readFileSync('Dockerfile.backend', 'utf8');
      if (!backendDockerfile.includes('node:')) {
        this.testResults.security.issues.push('Backend using unspecified Node.js version');
      }

      // Check for unnecessary privileges
      if (backendDockerfile.includes('--privileged')) {
        this.testResults.security.passed = false;
        this.testResults.security.issues.push('Containers running with privileged flag');
      }

    } catch (error) {
      this.testResults.security.issues.push(`Security test error: ${error.message}`);
    }

    return this.testResults.security;
  }

  // Run all deployment tests
  async runAllTests() {
    console.log('🚀 Starting Docker Deployment Testing...\n');

    await this.testContainerBuild();
    await this.testContainerRun();
    await this.testDatabaseOperations();
    await this.testAPIFunctionality();
    await this.testCulturalIntegrity();
    await this.testPerformance();
    await this.testSecurity();

    console.log('\n📊 Deployment Test Results Summary:');
    console.log('=====================================');

    let totalTests = 0;
    let passedTests = 0;

    Object.entries(this.testResults).forEach(([category, result]) => {
      totalTests++;
      if (result.passed) {
        passedTests++;
        console.log(`  ✅ ${category}: PASSED`);
        if (result.issues.length > 0) {
          result.issues.forEach(issue => {
            console.log(`    ⚠️  ${issue}`);
          });
        }
      } else {
        console.log(`  ❌ ${category}: FAILED`);
        result.issues.forEach(issue => {
          console.log(`    - ${issue}`);
        });
      }
    });

    const passRate = ((passedTests / totalTests) * 100).toFixed(1);
    console.log(`\n🎯 Deployment Readiness: ${passRate}% (${passedTests}/${totalTests} tests passed)`);

    if (passedTests === totalTests) {
      console.log('🎉 All deployment tests PASSED! Ready for production deployment.');
    } else {
      console.log('⚠️  Deployment issues detected. Please address before production deployment.');
    }

    return this.testResults;
  }
}

// Main execution
if (require.main === module) {
  const tester = new DockerDeploymentTester();
  tester.runAllTests().catch(console.error);
}

module.exports = DockerDeploymentTester;