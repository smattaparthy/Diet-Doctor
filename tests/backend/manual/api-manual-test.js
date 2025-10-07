// Manual API Testing Script
const http = require('http');

// Test data
const testData = {
  userRegistration: {
    email: 'test@culturaldiet.com',
    password: 'SecurePass123!',
    name: 'Test User',
    culturalBackground: 'hindu',
    dosha: 'pitta'
  },
  culturalValidation: {
    ingredient: 'beef',
    culturalBackground: 'hindu'
  }
};

// Helper function to make HTTP requests
function makeRequest(options, data = null) {
  return new Promise((resolve, reject) => {
    const client = http.request(options, (res) => {
      let responseData = '';

      res.on('data', (chunk) => {
        responseData += chunk;
      });

      res.on('end', () => {
        try {
          const parsedData = JSON.parse(responseData);
          resolve({ status: res.statusCode, data: parsedData });
        } catch (error) {
          resolve({ status: res.statusCode, data: responseData });
        }
      });
    });

    client.on('error', reject);

    if (data) {
      client.write(JSON.stringify(data));
    }

    client.end();
  });
}

// Test Functions
async function testHealthEndpoint() {
  console.log('\n🔍 Testing Health Endpoint...');

  const options = {
    hostname: 'localhost',
    port: 3002,
    path: '/health',
    method: 'GET',
    headers: {
      'Content-Type': 'application/json'
    }
  };

  try {
    const response = await makeRequest(options);
    console.log(`Status: ${response.status}`);
    console.log('Response:', response.data);

    if (response.status === 200 && response.data.status === 'healthy') {
      console.log('✅ Health endpoint test PASSED');
      return true;
    } else {
      console.log('❌ Health endpoint test FAILED');
      return false;
    }
  } catch (error) {
    console.log('❌ Health endpoint test ERROR:', error.message);
    return false;
  }
}

async function testCulturalRules() {
  console.log('\n🔍 Testing Cultural Rules...');

  const options = {
    hostname: 'localhost',
    port: 3002,
    path: '/api/v1/cultural-rules/forbidden-ingredients?culturalBackground=hindu',
    method: 'GET',
    headers: {
      'Content-Type': 'application/json'
    }
  };

  try {
    const response = await makeRequest(options);
    console.log(`Status: ${response.status}`);
    console.log('Response:', response.data);

    if (response.status === 200 && response.data.forbiddenIngredients) {
      const forbiddenIngredients = response.data.forbiddenIngredients;
      const hasRedMeat = forbiddenIngredients.some(meat =>
        ['beef', 'pork', 'lamb', 'veal'].includes(meat.toLowerCase())
      );

      if (hasRedMeat) {
        console.log('✅ Cultural rules test PASSED - Red meat is forbidden for Hindu diet');
        return true;
      } else {
        console.log('❌ Cultural rules test FAILED - Red meat not found in forbidden list');
        return false;
      }
    } else {
      console.log('❌ Cultural rules test FAILED - Unexpected response');
      return false;
    }
  } catch (error) {
    console.log('❌ Cultural rules test ERROR:', error.message);
    return false;
  }
}

async function testIngredientValidation() {
  console.log('\n🔍 Testing Ingredient Validation...');

  const options = {
    hostname: 'localhost',
    port: 3002,
    path: '/api/v1/cultural-rules/validate-ingredient',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    }
  };

  try {
    const response = await makeRequest(options, testData.culturalValidation);
    console.log(`Status: ${response.status}`);
    console.log('Response:', response.data);

    if (response.status === 200 && response.data.isAllowed === false) {
      console.log('✅ Ingredient validation test PASSED - Beef correctly forbidden for Hindu diet');
      return true;
    } else {
      console.log('❌ Ingredient validation test FAILED');
      return false;
    }
  } catch (error) {
    console.log('❌ Ingredient validation test ERROR:', error.message);
    return false;
  }
}

async function testUserRegistration() {
  console.log('\n🔍 Testing User Registration...');

  const options = {
    hostname: 'localhost',
    port: 3002,
    path: '/api/v1/auth/register',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    }
  };

  try {
    const response = await makeRequest(options, testData.userRegistration);
    console.log(`Status: ${response.status}`);
    console.log('Response:', response.data);

    if (response.status === 201 || response.status === 200) {
      console.log('✅ User registration test PASSED');
      return true;
    } else {
      console.log('❌ User registration test FAILED');
      return false;
    }
  } catch (error) {
    console.log('❌ User registration test ERROR:', error.message);
    return false;
  }
}

async function runAllTests() {
  console.log('🚀 Starting Cultural Diet API Manual Tests...\n');

  const results = {
    health: await testHealthEndpoint(),
    culturalRules: await testCulturalRules(),
    ingredientValidation: await testIngredientValidation(),
    userRegistration: await testUserRegistration()
  };

  console.log('\n📊 Test Results Summary:');
  console.log('========================');
  Object.entries(results).forEach(([test, passed]) => {
    const status = passed ? '✅ PASSED' : '❌ FAILED';
    const testName = test.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase());
    console.log(`${testName.padEnd(20)}: ${status}`);
  });

  const totalTests = Object.keys(results).length;
  const passedTests = Object.values(results).filter(Boolean).length;
  const passRate = ((passedTests / totalTests) * 100).toFixed(1);

  console.log('\n🎯 Overall Result:');
  console.log(`Passed: ${passedTests}/${totalTests} (${passRate}%)`);

  if (passedTests === totalTests) {
    console.log('🎉 All tests PASSED! API is functioning correctly.');
  } else {
    console.log('⚠️  Some tests FAILED. Please check the implementation.');
  }

  return results;
}

// Check if server is running first
async function checkServer() {
  try {
    await testHealthEndpoint();
    return true;
  } catch (error) {
    console.log('❌ Server is not running or not accessible');
    return false;
  }
}

// Main execution
if (require.main === module) {
  checkServer().then((serverRunning) => {
    if (serverRunning) {
      runAllTests();
    } else {
      console.log('\n💡 Please start the backend server first:');
      console.log('   npm run dev:backend');
      console.log('   or');
      console.log('   PORT=3001 npm run dev:backend');
    }
  });
}

module.exports = {
  testHealthEndpoint,
  testCulturalRules,
  testIngredientValidation,
  testUserRegistration,
  runAllTests
};