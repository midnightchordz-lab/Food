#====================================================================================================
# START - Testing Protocol - DO NOT EDIT OR REMOVE THIS SECTION
#====================================================================================================

# THIS SECTION CONTAINS CRITICAL TESTING INSTRUCTIONS FOR BOTH AGENTS
# BOTH MAIN_AGENT AND TESTING_AGENT MUST PRESERVE THIS ENTIRE BLOCK

# Communication Protocol:
# If the `testing_agent` is available, main agent should delegate all testing tasks to it.
#
# You have access to a file called `test_result.md`. This file contains the complete testing state
# and history, and is the primary means of communication between main and the testing agent.
#
# Main and testing agents must follow this exact format to maintain testing data. 
# The testing data must be entered in yaml format Below is the data structure:
# 
## user_problem_statement: {problem_statement}
## backend:
##   - task: "Task name"
##     implemented: true
##     working: true  # or false or "NA"
##     file: "file_path.py"
##     stuck_count: 0
##     priority: "high"  # or "medium" or "low"
##     needs_retesting: false
##     status_history:
##         -working: true  # or false or "NA"
##         -agent: "main"  # or "testing" or "user"
##         -comment: "Detailed comment about status"
##
## frontend:
##   - task: "Task name"
##     implemented: true
##     working: true  # or false or "NA"
##     file: "file_path.js"
##     stuck_count: 0
##     priority: "high"  # or "medium" or "low"
##     needs_retesting: false
##     status_history:
##         -working: true  # or false or "NA"
##         -agent: "main"  # or "testing" or "user"
##         -comment: "Detailed comment about status"
##
## metadata:
##   created_by: "main_agent"
##   version: "1.0"
##   test_sequence: 0
##   run_ui: false
##
## test_plan:
##   current_focus:
##     - "Task name 1"
##     - "Task name 2"
##   stuck_tasks:
##     - "Task name with persistent issues"
##   test_all: false
##   test_priority: "high_first"  # or "sequential" or "stuck_first"
##
## agent_communication:
##     -agent: "main"  # or "testing" or "user"
##     -message: "Communication message between agents"

# Protocol Guidelines for Main agent
#
# 1. Update Test Result File Before Testing:
#    - Main agent must always update the `test_result.md` file before calling the testing agent
#    - Add implementation details to the status_history
#    - Set `needs_retesting` to true for tasks that need testing
#    - Update the `test_plan` section to guide testing priorities
#    - Add a message to `agent_communication` explaining what you've done
#
# 2. Incorporate User Feedback:
#    - When a user provides feedback that something is or isn't working, add this information to the relevant task's status_history
#    - Update the working status based on user feedback
#    - If a user reports an issue with a task that was marked as working, increment the stuck_count
#    - Whenever user reports issue in the app, if we have testing agent and task_result.md file so find the appropriate task for that and append in status_history of that task to contain the user concern and problem as well 
#
# 3. Track Stuck Tasks:
#    - Monitor which tasks have high stuck_count values or where you are fixing same issue again and again, analyze that when you read task_result.md
#    - For persistent issues, use websearch tool to find solutions
#    - Pay special attention to tasks in the stuck_tasks list
#    - When you fix an issue with a stuck task, don't reset the stuck_count until the testing agent confirms it's working
#
# 4. Provide Context to Testing Agent:
#    - When calling the testing agent, provide clear instructions about:
#      - Which tasks need testing (reference the test_plan)
#      - Any authentication details or configuration needed
#      - Specific test scenarios to focus on
#    - Any known issues or edge cases to verify
#
# 5. Call the testing agent with specific instructions referring to test_result.md
#
# IMPORTANT: Main agent must ALWAYS update test_result.md BEFORE calling the testing agent, as it relies on this file to understand what to test next.

#====================================================================================================
# END - Testing Protocol - DO NOT EDIT OR REMOVE THIS SECTION
#====================================================================================================



#====================================================================================================
# Testing Data - Main Agent and testing sub agent both should log testing data below this section
#====================================================================================================

user_problem_statement: "MoodFood Expo React Native app - implement upcoming tasks: 1) Reactivate Subscription (cancelled users turn renewal back on), 2) Grace Messaging (show Premium ends on {date}), 3) Deletion Reasons (optional reason when deleting account), 4) Dietary Preference onboarding step (veg/vegan/halal choice)."

backend:
  - task: "dietary_preference field in user profile update"
    implemented: true
    working: "NA"
    file: "/app/backend/routes/auth.py"
    stuck_count: 0
    priority: "medium"
    needs_retesting: true
    status_history:
      - working: "NA"
        agent: "main"
        comment: "Added dietary_preference to allowed_fields in PUT /auth/profile endpoint. Previously only dietary_restrictions was allowed."

  - task: "Reactivate subscription endpoint"
    implemented: true
    working: "NA"
    file: "/app/backend/routes/subscription.py"
    stuck_count: 0
    priority: "high"
    needs_retesting: true
    status_history:
      - working: "NA"
        agent: "main"
        comment: "POST /subscription/reactivate endpoint already existed. It sets cancel_at_period_end=False in DB. Called from profile screen reactivate button."

frontend:
  - task: "Onboarding Dietary Preference screen"
    implemented: true
    working: "NA"
    file: "/app/frontend/app/onboarding-diet.tsx"
    stuck_count: 0
    priority: "medium"
    needs_retesting: true
    status_history:
      - working: "NA"
        agent: "main"
        comment: "New screen with 5 diet options (Non-veg, Vegetarian, Vegan, Halal, Jain). Navigation gate added in (tabs)/_layout.tsx - shows after allergy onboarding. AsyncStorage key dietOnboarded:{userId} tracks completion. Skip button available."

  - task: "Grace Messaging - Premium ends on date banner"
    implemented: true
    working: "NA"
    file: "/app/frontend/app/(tabs)/profile.tsx"
    stuck_count: 0
    priority: "medium"
    needs_retesting: true
    status_history:
      - working: "NA"
        agent: "main"
        comment: "When cancelAtPeriodEnd=true, shows yellow banner with calendar icon: 'Your Premium ends on {date}. Reactivate to keep all features.' periodEnd from premiumInfo is formatted as human-readable date."

  - task: "Reactivate Subscription UI"
    implemented: true
    working: "NA"
    file: "/app/frontend/app/(tabs)/profile.tsx"
    stuck_count: 0
    priority: "high"
    needs_retesting: true
    status_history:
      - working: "NA"
        agent: "main"
        comment: "When cancelAtPeriodEnd=true, profile shows 'Reactivate renewal' button (instead of Cancel). Calls POST /subscription/reactivate. On iOS redirects to App Store. Premium card shows 'Ending' ribbon and the period end date in description."

  - task: "Deletion Reasons Modal"
    implemented: true
    working: "NA"
    file: "/app/frontend/app/(tabs)/profile.tsx"
    stuck_count: 0
    priority: "medium"
    needs_retesting: true
    status_history:
      - working: "NA"
        agent: "main"
        comment: "Clicking Delete account now shows a bottom-sheet Modal with 6 optional reasons (Too expensive, Not using it enough, Missing a feature, Privacy concerns, Technical issues, Other). After reason selection (optional), user proceeds to destructive confirmation Alert."

metadata:
  created_by: "main_agent"
  version: "1.0"
  test_sequence: 1
  run_ui: true

test_plan:
  current_focus:
    - "Onboarding Dietary Preference screen"
    - "Grace Messaging - Premium ends on date banner"
    - "Reactivate Subscription UI"
    - "Deletion Reasons Modal"
    - "dietary_preference field in user profile update"
  stuck_tasks: []
  test_all: false
  test_priority: "high_first"

agent_communication:
  - agent: "main"
    message: "Implemented 4 features: 1) Dietary Preference onboarding screen (onboarding-diet.tsx) - new screen shown after allergy onboarding with 5 diet options, 2) Grace Messaging in profile - yellow warning banner when subscription is set to cancel, shows the end date, 3) Reactivate Subscription - button replaces Cancel when cancelAtPeriodEnd=true, 4) Deletion Reasons Modal - bottom sheet with optional reasons before confirming account deletion. Backend: added dietary_preference to auth profile allowed fields. Test credentials in /app/memory/test_credentials.md."
