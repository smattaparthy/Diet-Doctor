#!/bin/bash

# Authentication Test Script for Cultural Diet Application
# Tests login API endpoint with various scenarios
# Server: http://localhost:3000

BASE_URL="http://localhost:3000"
API_ENDPOINT="${BASE_URL}/api/v1/auth/login"
HEALTH_ENDPOINT="${BASE_URL}/health"

# ANSI color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Test counters
TOTAL_TESTS=0
PASSED_TESTS=0
FAILED_TESTS=0

# Results array
declare -a TEST_RESULTS

# Function to print section headers
print_header() {
    echo -e "\n${BLUE}═══════════════════════════════════════════════════════════════${NC}"
    echo -e "${CYAN}$1${NC}"
    echo -e "${BLUE}═══════════════════════════════════════════════════════════════${NC}\n"
}

# Function to print test results
print_result() {
    local test_name=$1
    local status=$2
    local message=$3

    TOTAL_TESTS=$((TOTAL_TESTS + 1))

    if [ "$status" == "PASS" ]; then
        echo -e "${GREEN}✓ PASS${NC} - $test_name"
        PASSED_TESTS=$((PASSED_TESTS + 1))
        TEST_RESULTS+=("PASS: $test_name")
    else
        echo -e "${RED}✗ FAIL${NC} - $test_name"
        FAILED_TESTS=$((FAILED_TESTS + 1))
        TEST_RESULTS+=("FAIL: $test_name - $message")
    fi

    if [ -n "$message" ]; then
        echo -e "  ${YELLOW}→${NC} $message"
    fi
}

# Function to measure response time
measure_response_time() {
    local start=$(date +%s%N)
    eval "$1" > /dev/null 2>&1
    local end=$(date +%s%N)
    local duration=$((($end - $start) / 1000000)) # Convert to milliseconds
    echo $duration
}

# Test 1: Server Health Check
test_server_health() {
    print_header "TEST 1: Server Health Check"

    response=$(curl -s -w "\n%{http_code}" "$HEALTH_ENDPOINT" 2>&1)
    http_code=$(echo "$response" | tail -n1)
    body=$(echo "$response" | sed '$d')

    if [ "$http_code" == "200" ]; then
        print_result "Server Health Check" "PASS" "Server is running and healthy"
        echo -e "  Response: $body"
    else
        print_result "Server Health Check" "FAIL" "Server returned HTTP $http_code"
        echo -e "  Expected: 200, Got: $http_code"
        exit 1
    fi
}

# Test 2: Valid Login Credentials
test_valid_login() {
    print_header "TEST 2: Valid Login Credentials"

    local payload='{
        "email": "demo@culturaldiet.com",
        "password": "DemoUser123@"
    }'

    # Measure response time
    start_time=$(date +%s%N)

    response=$(curl -s -w "\n%{http_code}" \
        -X POST "$API_ENDPOINT" \
        -H "Content-Type: application/json" \
        -d "$payload" 2>&1)

    end_time=$(date +%s%N)
    response_time=$((($end_time - $start_time) / 1000000)) # Convert to ms

    http_code=$(echo "$response" | tail -n1)
    body=$(echo "$response" | sed '$d')

    echo -e "${CYAN}Response Time:${NC} ${response_time}ms"
    echo -e "${CYAN}HTTP Status:${NC} $http_code"
    echo -e "${CYAN}Response Body:${NC}"
    echo "$body" | jq '.' 2>/dev/null || echo "$body"

    # Validate response
    if [ "$http_code" == "200" ]; then
        # Check if response contains required fields
        success=$(echo "$body" | jq -r '.success' 2>/dev/null)
        token=$(echo "$body" | jq -r '.data.token' 2>/dev/null)
        user_email=$(echo "$body" | jq -r '.data.user.email' 2>/dev/null)

        if [ "$success" == "true" ] && [ "$token" != "null" ] && [ "$user_email" == "demo@culturaldiet.com" ]; then
            print_result "Valid Login - Success Field" "PASS" "success = true"
            print_result "Valid Login - JWT Token" "PASS" "Token generated successfully"
            print_result "Valid Login - User Email" "PASS" "Email matches: $user_email"
            print_result "Valid Login - Response Time" "PASS" "Response time: ${response_time}ms"

            # Store token for subsequent tests
            export AUTH_TOKEN="$token"

            # Validate user data fields
            dosha=$(echo "$body" | jq -r '.data.user.dosha' 2>/dev/null)
            cuisine_prefs=$(echo "$body" | jq -r '.data.user.cuisine_preferences' 2>/dev/null)
            dietary_restrictions=$(echo "$body" | jq -r '.data.user.dietary_restrictions' 2>/dev/null)

            echo -e "\n${CYAN}User Data Validation:${NC}"
            echo -e "  Dosha: $dosha"
            echo -e "  Cuisine Preferences: $cuisine_prefs"
            echo -e "  Dietary Restrictions: $dietary_restrictions"

            if [ "$dosha" != "null" ]; then
                print_result "User Data - Dosha Field" "PASS" "Dosha: $dosha"
            else
                print_result "User Data - Dosha Field" "PASS" "Dosha is null (acceptable)"
            fi

            if [ "$cuisine_prefs" != "null" ]; then
                print_result "User Data - Cuisine Preferences" "PASS" "Preferences exist"
            else
                print_result "User Data - Cuisine Preferences" "FAIL" "No cuisine preferences"
            fi
        else
            print_result "Valid Login - Response Structure" "FAIL" "Missing required fields in response"
        fi
    else
        print_result "Valid Login" "FAIL" "Expected HTTP 200, got $http_code"
    fi
}

# Test 3: Invalid Email
test_invalid_email() {
    print_header "TEST 3: Invalid Email (Non-existent User)"

    local payload='{
        "email": "nonexistent@culturaldiet.com",
        "password": "DemoUser123@"
    }'

    response=$(curl -s -w "\n%{http_code}" \
        -X POST "$API_ENDPOINT" \
        -H "Content-Type: application/json" \
        -d "$payload" 2>&1)

    http_code=$(echo "$response" | tail -n1)
    body=$(echo "$response" | sed '$d')

    echo -e "${CYAN}HTTP Status:${NC} $http_code"
    echo -e "${CYAN}Response Body:${NC}"
    echo "$body" | jq '.' 2>/dev/null || echo "$body"

    if [ "$http_code" == "401" ]; then
        error_code=$(echo "$body" | jq -r '.code' 2>/dev/null)
        success=$(echo "$body" | jq -r '.success' 2>/dev/null)

        if [ "$error_code" == "INVALID_CREDENTIALS" ] && [ "$success" == "false" ]; then
            print_result "Invalid Email - HTTP Status" "PASS" "Returns 401 Unauthorized"
            print_result "Invalid Email - Error Code" "PASS" "Code: INVALID_CREDENTIALS"
            print_result "Invalid Email - Success Flag" "PASS" "success = false"
        else
            print_result "Invalid Email - Error Response" "FAIL" "Incorrect error structure"
        fi
    else
        print_result "Invalid Email" "FAIL" "Expected HTTP 401, got $http_code"
    fi
}

# Test 4: Invalid Password
test_invalid_password() {
    print_header "TEST 4: Invalid Password (Correct Email, Wrong Password)"

    local payload='{
        "email": "demo@culturaldiet.com",
        "password": "WrongPassword123@"
    }'

    response=$(curl -s -w "\n%{http_code}" \
        -X POST "$API_ENDPOINT" \
        -H "Content-Type: application/json" \
        -d "$payload" 2>&1)

    http_code=$(echo "$response" | tail -n1)
    body=$(echo "$response" | sed '$d')

    echo -e "${CYAN}HTTP Status:${NC} $http_code"
    echo -e "${CYAN}Response Body:${NC}"
    echo "$body" | jq '.' 2>/dev/null || echo "$body"

    if [ "$http_code" == "401" ]; then
        error_code=$(echo "$body" | jq -r '.code' 2>/dev/null)
        success=$(echo "$body" | jq -r '.success' 2>/dev/null)

        if [ "$error_code" == "INVALID_CREDENTIALS" ] && [ "$success" == "false" ]; then
            print_result "Invalid Password - HTTP Status" "PASS" "Returns 401 Unauthorized"
            print_result "Invalid Password - Error Code" "PASS" "Code: INVALID_CREDENTIALS"
            print_result "Invalid Password - Success Flag" "PASS" "success = false"
        else
            print_result "Invalid Password - Error Response" "FAIL" "Incorrect error structure"
        fi
    else
        print_result "Invalid Password" "FAIL" "Expected HTTP 401, got $http_code"
    fi
}

# Test 5: Missing Email Field
test_missing_email() {
    print_header "TEST 5: Missing Email Field"

    local payload='{
        "password": "DemoUser123@"
    }'

    response=$(curl -s -w "\n%{http_code}" \
        -X POST "$API_ENDPOINT" \
        -H "Content-Type: application/json" \
        -d "$payload" 2>&1)

    http_code=$(echo "$response" | tail -n1)
    body=$(echo "$response" | sed '$d')

    echo -e "${CYAN}HTTP Status:${NC} $http_code"
    echo -e "${CYAN}Response Body:${NC}"
    echo "$body" | jq '.' 2>/dev/null || echo "$body"

    if [ "$http_code" == "401" ] || [ "$http_code" == "400" ]; then
        print_result "Missing Email - HTTP Status" "PASS" "Returns $http_code (Unauthorized/Bad Request)"
    else
        print_result "Missing Email" "FAIL" "Expected HTTP 401 or 400, got $http_code"
    fi
}

# Test 6: Missing Password Field
test_missing_password() {
    print_header "TEST 6: Missing Password Field"

    local payload='{
        "email": "demo@culturaldiet.com"
    }'

    response=$(curl -s -w "\n%{http_code}" \
        -X POST "$API_ENDPOINT" \
        -H "Content-Type: application/json" \
        -d "$payload" 2>&1)

    http_code=$(echo "$response" | tail -n1)
    body=$(echo "$response" | sed '$d')

    echo -e "${CYAN}HTTP Status:${NC} $http_code"
    echo -e "${CYAN}Response Body:${NC}"
    echo "$body" | jq '.' 2>/dev/null || echo "$body"

    if [ "$http_code" == "401" ] || [ "$http_code" == "400" ]; then
        print_result "Missing Password - HTTP Status" "PASS" "Returns $http_code (Unauthorized/Bad Request)"
    else
        print_result "Missing Password" "FAIL" "Expected HTTP 401 or 400, got $http_code"
    fi
}

# Test 7: Empty Payload
test_empty_payload() {
    print_header "TEST 7: Empty Payload"

    local payload='{}'

    response=$(curl -s -w "\n%{http_code}" \
        -X POST "$API_ENDPOINT" \
        -H "Content-Type: application/json" \
        -d "$payload" 2>&1)

    http_code=$(echo "$response" | tail -n1)
    body=$(echo "$response" | sed '$d')

    echo -e "${CYAN}HTTP Status:${NC} $http_code"
    echo -e "${CYAN}Response Body:${NC}"
    echo "$body" | jq '.' 2>/dev/null || echo "$body"

    if [ "$http_code" == "401" ] || [ "$http_code" == "400" ]; then
        print_result "Empty Payload - HTTP Status" "PASS" "Returns $http_code (Unauthorized/Bad Request)"
    else
        print_result "Empty Payload" "FAIL" "Expected HTTP 401 or 400, got $http_code"
    fi
}

# Test 8: Malformed JSON
test_malformed_json() {
    print_header "TEST 8: Malformed JSON"

    local payload='{"email": "demo@culturaldiet.com", "password": '

    response=$(curl -s -w "\n%{http_code}" \
        -X POST "$API_ENDPOINT" \
        -H "Content-Type: application/json" \
        -d "$payload" 2>&1)

    http_code=$(echo "$response" | tail -n1)
    body=$(echo "$response" | sed '$d')

    echo -e "${CYAN}HTTP Status:${NC} $http_code"
    echo -e "${CYAN}Response Body:${NC}"
    echo "$body" | head -n 5

    if [ "$http_code" == "400" ] || [ "$http_code" == "500" ]; then
        print_result "Malformed JSON - HTTP Status" "PASS" "Returns $http_code (Bad Request/Server Error)"
    else
        print_result "Malformed JSON" "FAIL" "Expected HTTP 400 or 500, got $http_code"
    fi
}

# Test 9: JWT Token Structure Validation
test_jwt_structure() {
    print_header "TEST 9: JWT Token Structure Validation"

    if [ -z "$AUTH_TOKEN" ]; then
        print_result "JWT Structure" "FAIL" "No token available from valid login test"
        return
    fi

    echo -e "${CYAN}Token:${NC} $AUTH_TOKEN"

    # JWT should have 3 parts separated by dots
    token_parts=$(echo "$AUTH_TOKEN" | tr '.' '\n' | wc -l)

    if [ "$token_parts" -eq 3 ]; then
        print_result "JWT Structure - Three Parts" "PASS" "Token has 3 parts (header.payload.signature)"

        # Decode payload (base64url decode)
        payload_part=$(echo "$AUTH_TOKEN" | cut -d'.' -f2)
        # Add padding if needed
        padding_length=$((4 - ${#payload_part} % 4))
        if [ $padding_length -ne 4 ]; then
            payload_part="${payload_part}$(printf '=%.0s' $(seq 1 $padding_length))"
        fi

        decoded=$(echo "$payload_part" | base64 -d 2>/dev/null || echo "$payload_part" | base64 -D 2>/dev/null)
        echo -e "${CYAN}Decoded Payload:${NC}"
        echo "$decoded" | jq '.' 2>/dev/null || echo "$decoded"

        # Check for required claims
        user_id=$(echo "$decoded" | jq -r '.userId' 2>/dev/null)
        email=$(echo "$decoded" | jq -r '.email' 2>/dev/null)
        exp=$(echo "$decoded" | jq -r '.exp' 2>/dev/null)

        if [ "$user_id" != "null" ] && [ -n "$user_id" ]; then
            print_result "JWT Payload - userId Claim" "PASS" "userId: $user_id"
        else
            print_result "JWT Payload - userId Claim" "FAIL" "Missing userId"
        fi

        if [ "$email" == "demo@culturaldiet.com" ]; then
            print_result "JWT Payload - Email Claim" "PASS" "Email: $email"
        else
            print_result "JWT Payload - Email Claim" "FAIL" "Email mismatch or missing"
        fi

        if [ "$exp" != "null" ] && [ -n "$exp" ]; then
            current_time=$(date +%s)
            if [ "$exp" -gt "$current_time" ]; then
                print_result "JWT Payload - Expiration" "PASS" "Token not expired (exp: $exp)"
            else
                print_result "JWT Payload - Expiration" "FAIL" "Token is expired"
            fi
        else
            print_result "JWT Payload - Expiration" "FAIL" "Missing expiration claim"
        fi
    else
        print_result "JWT Structure" "FAIL" "Token does not have 3 parts"
    fi
}

# Test 10: Performance Benchmark
test_performance() {
    print_header "TEST 10: Performance Benchmark (5 Requests)"

    local payload='{
        "email": "demo@culturaldiet.com",
        "password": "DemoUser123@"
    }'

    local total_time=0
    local min_time=999999
    local max_time=0
    local iterations=5

    echo -e "${CYAN}Running $iterations login requests...${NC}\n"

    for i in $(seq 1 $iterations); do
        start_time=$(date +%s%N)

        response=$(curl -s -w "\n%{http_code}" \
            -X POST "$API_ENDPOINT" \
            -H "Content-Type: application/json" \
            -d "$payload" 2>&1)

        end_time=$(date +%s%N)
        response_time=$((($end_time - $start_time) / 1000000)) # Convert to ms

        http_code=$(echo "$response" | tail -n1)

        echo -e "  Request $i: ${response_time}ms (HTTP $http_code)"

        total_time=$((total_time + response_time))

        if [ $response_time -lt $min_time ]; then
            min_time=$response_time
        fi

        if [ $response_time -gt $max_time ]; then
            max_time=$response_time
        fi
    done

    avg_time=$((total_time / iterations))

    echo -e "\n${CYAN}Performance Statistics:${NC}"
    echo -e "  Minimum: ${min_time}ms"
    echo -e "  Maximum: ${max_time}ms"
    echo -e "  Average: ${avg_time}ms"

    if [ $avg_time -lt 500 ]; then
        print_result "Performance - Average Response Time" "PASS" "Average: ${avg_time}ms (< 500ms)"
    elif [ $avg_time -lt 1000 ]; then
        print_result "Performance - Average Response Time" "PASS" "Average: ${avg_time}ms (< 1000ms, could be improved)"
    else
        print_result "Performance - Average Response Time" "FAIL" "Average: ${avg_time}ms (> 1000ms, needs optimization)"
    fi
}

# Generate Test Summary
generate_summary() {
    print_header "TEST SUMMARY"

    echo -e "${CYAN}Total Tests:${NC} $TOTAL_TESTS"
    echo -e "${GREEN}Passed:${NC} $PASSED_TESTS"
    echo -e "${RED}Failed:${NC} $FAILED_TESTS"

    success_rate=$((PASSED_TESTS * 100 / TOTAL_TESTS))
    echo -e "${CYAN}Success Rate:${NC} ${success_rate}%"

    if [ $FAILED_TESTS -eq 0 ]; then
        echo -e "\n${GREEN}✓ ALL TESTS PASSED!${NC}"
    else
        echo -e "\n${RED}✗ SOME TESTS FAILED${NC}"
        echo -e "\n${YELLOW}Failed Tests:${NC}"
        for result in "${TEST_RESULTS[@]}"; do
            if [[ $result == FAIL* ]]; then
                echo -e "  ${RED}•${NC} ${result#FAIL: }"
            fi
        done
    fi
}

# Main execution
main() {
    clear
    print_header "CULTURAL DIET - LOGIN AUTHENTICATION TEST SUITE"
    echo -e "${CYAN}Testing API Endpoint:${NC} $API_ENDPOINT"
    echo -e "${CYAN}Timestamp:${NC} $(date)"

    # Run all tests
    test_server_health
    test_valid_login
    test_invalid_email
    test_invalid_password
    test_missing_email
    test_missing_password
    test_empty_payload
    test_malformed_json
    test_jwt_structure
    test_performance

    # Generate summary
    generate_summary

    # Exit with appropriate code
    if [ $FAILED_TESTS -eq 0 ]; then
        exit 0
    else
        exit 1
    fi
}

# Run main function
main
