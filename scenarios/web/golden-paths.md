# Golden Path Scenarios

Critical user journeys through the AmakaFlow UI. These tests verify the happy path works end-to-end.

## Prerequisites

- All services must be healthy (run health-checks first)
- Tests use data-testid selectors where available
- Each scenario starts from a fresh browser state

---

## Scenario: Homepage Navigation

### Step 1: Load homepage
- **Tool**: Browser
- **Action**: open http://localhost:3000
- **Wait**: networkidle
- **Expected**: Page loads successfully
- **Screenshot**: golden-homepage-initial.png

### Step 2: Verify main elements present
- **Tool**: Browser
- **Action**: wait [data-testid="main-content"]
- **Expected**: Main content area is visible
- **Screenshot**: golden-homepage-content.png

### Step 3: Check for console errors
- **Tool**: Browser
- **Action**: console
- **Expected**: No ERROR level messages

---

## Scenario: Chat Interface Loads

### Step 1: Navigate to chat
- **Tool**: Browser
- **Action**: open http://localhost:3000
- **Wait**: networkidle
- **Screenshot**: golden-chat-navigate.png

### Step 2: Verify chat component renders
- **Tool**: Browser
- **Action**: wait [data-testid="chat-container"]
- **Timeout**: 10s
- **Expected**: Chat container is visible
- **Screenshot**: golden-chat-loaded.png

### Step 3: Verify input field is present
- **Tool**: Browser
- **Action**: wait [data-testid="chat-input"]
- **Expected**: Chat input field is visible and enabled
- **Screenshot**: golden-chat-input.png

### Step 4: Check no console errors
- **Tool**: Browser
- **Action**: console
- **Expected**: No ERROR level messages

---

## Scenario: Chat Message Flow

**Note**: This scenario requires authentication to be mocked or skipped.

### Step 1: Load chat interface
- **Tool**: Browser
- **Action**: open http://localhost:3000
- **Wait**: networkidle
- **Screenshot**: golden-message-start.png

### Step 2: Focus chat input
- **Tool**: Browser
- **Action**: click [data-testid="chat-input"]
- **Expected**: Input is focused
- **Screenshot**: golden-message-focused.png

### Step 3: Type a message
- **Tool**: Browser
- **Action**: type [data-testid="chat-input"] "Hello, this is a test message"
- **Expected**: Text appears in input
- **Screenshot**: golden-message-typed.png

### Step 4: Check no errors
- **Tool**: Browser
- **Action**: console
- **Expected**: No ERROR level messages

---

## Scenario: Navigation Elements

### Step 1: Load homepage
- **Tool**: Browser
- **Action**: open http://localhost:3000
- **Wait**: networkidle
- **Screenshot**: golden-nav-initial.png

### Step 2: Verify navigation is present
- **Tool**: Browser
- **Action**: wait nav, header
- **Expected**: Navigation/header element exists
- **Screenshot**: golden-nav-header.png

### Step 3: Check responsive layout
- **Tool**: Browser
- **Action**: screenshot golden-nav-desktop.png
- **Expected**: Layout renders correctly at default viewport (1280x720)

---

## Scenario: Error Boundary Test

### Step 1: Load application
- **Tool**: Browser
- **Action**: open http://localhost:3000
- **Wait**: networkidle
- **Screenshot**: golden-error-initial.png

### Step 2: Verify no error boundary triggered
- **Tool**: Browser
- **Action**: wait [data-testid="error-boundary"]
- **Expected**: Element should NOT be present (test passes if wait times out)
- **Screenshot**: golden-error-none.png

### Step 3: Check console for React errors
- **Tool**: Browser
- **Action**: console
- **Expected**: No React error boundaries triggered, no uncaught exceptions

---

## Test Data Notes

These golden path tests do NOT:
- Create real user accounts
- Store data in production databases
- Make external API calls

They DO verify:
- UI components render correctly
- Navigation works
- Chat interface is functional
- No JavaScript errors occur

---

## Pass Criteria

- All pages load within 30s
- No JavaScript console errors (warnings acceptable)
- All data-testid elements are findable
- Screenshots capture expected UI state
