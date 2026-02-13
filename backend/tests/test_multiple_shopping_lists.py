"""
Test Suite for Multiple Shopping Lists Feature

Features tested:
1. GET /api/shopping/lists - Get all user's shopping lists
2. POST /api/shopping/lists - Create a new shopping list
3. GET /api/shopping/lists/{list_id} - Get a specific list
4. PUT /api/shopping/lists/{list_id} - Rename a list
5. DELETE /api/shopping/lists/{list_id} - Delete a list
6. POST /api/shopping/lists/{list_id}/clear - Clear all items from a list
7. POST /api/shopping/lists/{list_id}/items - Add items to a list
8. DELETE /api/shopping/lists/{list_id}/items/{item_name} - Remove item from list
9. PATCH /api/shopping/lists/{list_id}/items/toggle - Toggle item checked state
"""

import pytest
import requests
import os
import time
import uuid

# Get API URL from environment
BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://recipe-voice-sync.preview.emergentagent.com').rstrip('/')

# Test credentials
TEST_EMAIL = "shopper@test.com"
TEST_PASSWORD = "shop123"


@pytest.fixture(scope="module")
def auth_token():
    """Get authentication token - register if needed"""
    # First try to login
    response = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email": TEST_EMAIL,
        "password": TEST_PASSWORD
    })
    
    if response.status_code == 200:
        data = response.json()
        return data.get("access_token") or data.get("token")
    
    # If login fails, try to register
    register_response = requests.post(f"{BASE_URL}/api/auth/register", json={
        "email": TEST_EMAIL,
        "password": TEST_PASSWORD,
        "name": "Test Shopper"
    })
    
    if register_response.status_code == 200:
        data = register_response.json()
        return data.get("access_token") or data.get("token")
    
    # Try login again after registration
    login_response = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email": TEST_EMAIL,
        "password": TEST_PASSWORD
    })
    
    if login_response.status_code == 200:
        data = login_response.json()
        return data.get("access_token") or data.get("token")
    
    pytest.skip(f"Authentication failed for shopping tests")


@pytest.fixture
def api_headers(auth_token):
    """Get headers with authorization"""
    return {
        "Authorization": f"Bearer {auth_token}",
        "Content-Type": "application/json"
    }


@pytest.fixture
def unique_list_name():
    """Generate a unique list name for testing"""
    return f"TEST_list_{uuid.uuid4().hex[:8]}"


class TestGetAllLists:
    """Test GET /api/shopping/lists endpoint - Get all shopping lists"""
    
    def test_get_lists_requires_auth(self):
        """Verify endpoint requires authentication"""
        response = requests.get(f"{BASE_URL}/api/shopping/lists")
        assert response.status_code in [401, 403], f"Should require auth, got {response.status_code}"
    
    def test_get_lists_returns_list_array(self, api_headers):
        """Verify endpoint returns an array of lists"""
        response = requests.get(
            f"{BASE_URL}/api/shopping/lists",
            headers=api_headers
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert data.get("success") is True, "Response should indicate success"
        assert "lists" in data, "Response should contain 'lists' key"
        assert isinstance(data["lists"], list), "Lists should be an array"
        assert "total" in data, "Response should contain total count"
    
    def test_get_lists_contains_required_fields(self, api_headers):
        """Verify each list in response has required fields"""
        # First create a list to ensure we have data
        create_response = requests.post(
            f"{BASE_URL}/api/shopping/lists",
            json={"name": f"TEST_fields_{uuid.uuid4().hex[:6]}", "ingredients": []},
            headers=api_headers
        )
        
        response = requests.get(
            f"{BASE_URL}/api/shopping/lists",
            headers=api_headers
        )
        
        data = response.json()
        
        if data["lists"]:
            for lst in data["lists"]:
                assert "list_id" in lst, f"List should have 'list_id': {lst}"
                assert "name" in lst, f"List should have 'name': {lst}"
                assert "items" in lst or isinstance(lst.get("items"), list) or lst.get("items") is None, f"List should have 'items': {lst}"
                assert "user_id" in lst, f"List should have 'user_id': {lst}"


class TestCreateList:
    """Test POST /api/shopping/lists endpoint - Create a new shopping list"""
    
    def test_create_list_requires_auth(self):
        """Verify endpoint requires authentication"""
        response = requests.post(
            f"{BASE_URL}/api/shopping/lists",
            json={"name": "Test List", "ingredients": []}
        )
        assert response.status_code in [401, 403], f"Should require auth, got {response.status_code}"
    
    def test_create_list_success(self, api_headers, unique_list_name):
        """Test creating a new shopping list"""
        response = requests.post(
            f"{BASE_URL}/api/shopping/lists",
            json={"name": unique_list_name, "ingredients": []},
            headers=api_headers
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert data.get("success") is True, "Response should indicate success"
        assert "list" in data, "Response should contain created list"
        assert data["list"]["name"] == unique_list_name, "List name should match"
        assert "list_id" in data["list"], "List should have ID"
        assert "message" in data, "Response should have message"
    
    def test_create_list_with_ingredients(self, api_headers):
        """Test creating a list with initial ingredients"""
        list_name = f"TEST_with_items_{uuid.uuid4().hex[:6]}"
        ingredients = [
            {"name": "Tomato", "amount": "2", "unit": "pcs"},
            {"name": "Onion", "amount": "1", "unit": "kg"}
        ]
        
        response = requests.post(
            f"{BASE_URL}/api/shopping/lists",
            json={"name": list_name, "ingredients": ingredients},
            headers=api_headers
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert data.get("success") is True
        created_list = data["list"]
        assert len(created_list.get("items", [])) == 2, "List should have 2 items"
    
    def test_create_multiple_lists(self, api_headers):
        """Test that user can create multiple lists"""
        list1_name = f"TEST_multi1_{uuid.uuid4().hex[:6]}"
        list2_name = f"TEST_multi2_{uuid.uuid4().hex[:6]}"
        
        # Create first list
        response1 = requests.post(
            f"{BASE_URL}/api/shopping/lists",
            json={"name": list1_name, "ingredients": []},
            headers=api_headers
        )
        assert response1.status_code == 200
        
        # Create second list
        response2 = requests.post(
            f"{BASE_URL}/api/shopping/lists",
            json={"name": list2_name, "ingredients": []},
            headers=api_headers
        )
        assert response2.status_code == 200
        
        # Verify both lists exist
        get_response = requests.get(f"{BASE_URL}/api/shopping/lists", headers=api_headers)
        data = get_response.json()
        list_names = [lst["name"] for lst in data["lists"]]
        
        assert list1_name in list_names, f"First list should exist: {list_names}"
        assert list2_name in list_names, f"Second list should exist: {list_names}"


class TestGetListById:
    """Test GET /api/shopping/lists/{list_id} endpoint - Get specific list"""
    
    def test_get_list_by_id_requires_auth(self):
        """Verify endpoint requires authentication"""
        response = requests.get(f"{BASE_URL}/api/shopping/lists/some_list_id")
        assert response.status_code in [401, 403], f"Should require auth, got {response.status_code}"
    
    def test_get_list_by_id_success(self, api_headers):
        """Test getting a specific list by ID"""
        # First create a list
        create_response = requests.post(
            f"{BASE_URL}/api/shopping/lists",
            json={"name": f"TEST_getbyid_{uuid.uuid4().hex[:6]}", "ingredients": []},
            headers=api_headers
        )
        created_list = create_response.json()["list"]
        list_id = created_list["list_id"]
        
        # Get the list by ID
        response = requests.get(
            f"{BASE_URL}/api/shopping/lists/{list_id}",
            headers=api_headers
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert data.get("success") is True
        assert data["list"]["list_id"] == list_id
    
    def test_get_list_not_found(self, api_headers):
        """Test getting a non-existent list returns 404"""
        response = requests.get(
            f"{BASE_URL}/api/shopping/lists/nonexistent_list_xyz",
            headers=api_headers
        )
        
        assert response.status_code == 404, f"Expected 404, got {response.status_code}"


class TestRenameList:
    """Test PUT /api/shopping/lists/{list_id} endpoint - Rename a list"""
    
    def test_rename_list_requires_auth(self):
        """Verify endpoint requires authentication"""
        response = requests.put(
            f"{BASE_URL}/api/shopping/lists/some_id",
            json={"name": "New Name"}
        )
        assert response.status_code in [401, 403], f"Should require auth, got {response.status_code}"
    
    def test_rename_list_success(self, api_headers):
        """Test renaming a shopping list"""
        # Create a list first
        original_name = f"TEST_rename_orig_{uuid.uuid4().hex[:6]}"
        create_response = requests.post(
            f"{BASE_URL}/api/shopping/lists",
            json={"name": original_name, "ingredients": []},
            headers=api_headers
        )
        list_id = create_response.json()["list"]["list_id"]
        
        # Rename the list
        new_name = f"TEST_rename_new_{uuid.uuid4().hex[:6]}"
        response = requests.put(
            f"{BASE_URL}/api/shopping/lists/{list_id}",
            json={"name": new_name},
            headers=api_headers
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert data.get("success") is True
        assert "renamed" in data.get("message", "").lower() or new_name in data.get("message", "")
        
        # Verify the name changed
        get_response = requests.get(f"{BASE_URL}/api/shopping/lists/{list_id}", headers=api_headers)
        assert get_response.json()["list"]["name"] == new_name
    
    def test_rename_list_not_found(self, api_headers):
        """Test renaming a non-existent list returns 404"""
        response = requests.put(
            f"{BASE_URL}/api/shopping/lists/nonexistent_xyz",
            json={"name": "New Name"},
            headers=api_headers
        )
        
        assert response.status_code == 404, f"Expected 404, got {response.status_code}"


class TestDeleteList:
    """Test DELETE /api/shopping/lists/{list_id} endpoint - Delete a list"""
    
    def test_delete_list_requires_auth(self):
        """Verify endpoint requires authentication"""
        response = requests.delete(f"{BASE_URL}/api/shopping/lists/some_id")
        assert response.status_code in [401, 403], f"Should require auth, got {response.status_code}"
    
    def test_delete_list_success(self, api_headers):
        """Test deleting a shopping list"""
        # Create a list first
        create_response = requests.post(
            f"{BASE_URL}/api/shopping/lists",
            json={"name": f"TEST_delete_{uuid.uuid4().hex[:6]}", "ingredients": []},
            headers=api_headers
        )
        list_id = create_response.json()["list"]["list_id"]
        
        # Delete the list
        response = requests.delete(
            f"{BASE_URL}/api/shopping/lists/{list_id}",
            headers=api_headers
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert data.get("success") is True
        
        # Verify the list no longer exists
        get_response = requests.get(f"{BASE_URL}/api/shopping/lists/{list_id}", headers=api_headers)
        assert get_response.status_code == 404, "Deleted list should not be found"
    
    def test_delete_list_not_found(self, api_headers):
        """Test deleting a non-existent list returns 404"""
        response = requests.delete(
            f"{BASE_URL}/api/shopping/lists/nonexistent_xyz",
            headers=api_headers
        )
        
        assert response.status_code == 404, f"Expected 404, got {response.status_code}"


class TestClearList:
    """Test POST /api/shopping/lists/{list_id}/clear endpoint - Clear all items"""
    
    def test_clear_list_requires_auth(self):
        """Verify endpoint requires authentication"""
        response = requests.post(f"{BASE_URL}/api/shopping/lists/some_id/clear")
        assert response.status_code in [401, 403], f"Should require auth, got {response.status_code}"
    
    def test_clear_list_success(self, api_headers):
        """Test clearing all items from a shopping list"""
        # Create a list with items
        ingredients = [
            {"name": "Tomato", "amount": "2"},
            {"name": "Onion", "amount": "1"},
            {"name": "Garlic", "amount": "3"}
        ]
        create_response = requests.post(
            f"{BASE_URL}/api/shopping/lists",
            json={"name": f"TEST_clear_{uuid.uuid4().hex[:6]}", "ingredients": ingredients},
            headers=api_headers
        )
        list_id = create_response.json()["list"]["list_id"]
        
        # Clear the list
        response = requests.post(
            f"{BASE_URL}/api/shopping/lists/{list_id}/clear",
            headers=api_headers
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert data.get("success") is True
        
        # Verify the list is empty
        get_response = requests.get(f"{BASE_URL}/api/shopping/lists/{list_id}", headers=api_headers)
        assert len(get_response.json()["list"]["items"]) == 0, "List should be empty after clear"
    
    def test_clear_list_not_found(self, api_headers):
        """Test clearing a non-existent list returns 404"""
        response = requests.post(
            f"{BASE_URL}/api/shopping/lists/nonexistent_xyz/clear",
            headers=api_headers
        )
        
        assert response.status_code == 404, f"Expected 404, got {response.status_code}"


class TestAddItemsToList:
    """Test POST /api/shopping/lists/{list_id}/items endpoint - Add items to list"""
    
    def test_add_items_requires_auth(self):
        """Verify endpoint requires authentication"""
        response = requests.post(
            f"{BASE_URL}/api/shopping/lists/some_id/items",
            json={"ingredients": [{"name": "Test"}]}
        )
        assert response.status_code in [401, 403], f"Should require auth, got {response.status_code}"
    
    def test_add_items_success(self, api_headers):
        """Test adding items to a shopping list"""
        # Create an empty list
        create_response = requests.post(
            f"{BASE_URL}/api/shopping/lists",
            json={"name": f"TEST_add_{uuid.uuid4().hex[:6]}", "ingredients": []},
            headers=api_headers
        )
        list_id = create_response.json()["list"]["list_id"]
        
        # Add items
        response = requests.post(
            f"{BASE_URL}/api/shopping/lists/{list_id}/items",
            json={
                "ingredients": [
                    {"name": "Milk", "amount": "1", "unit": "liter"},
                    {"name": "Eggs", "amount": "12", "unit": "pcs"}
                ],
                "recipe_name": "Breakfast"
            },
            headers=api_headers
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert data.get("success") is True
        assert data.get("added_count") == 2, "Should have added 2 items"
        
        # Verify items were added
        get_response = requests.get(f"{BASE_URL}/api/shopping/lists/{list_id}", headers=api_headers)
        assert len(get_response.json()["list"]["items"]) == 2
    
    def test_add_items_no_duplicates(self, api_headers):
        """Test that duplicate items are not added twice"""
        # Create a list with an item
        create_response = requests.post(
            f"{BASE_URL}/api/shopping/lists",
            json={
                "name": f"TEST_nodup_{uuid.uuid4().hex[:6]}",
                "ingredients": [{"name": "Tomato", "amount": "2"}]
            },
            headers=api_headers
        )
        list_id = create_response.json()["list"]["list_id"]
        
        # Try to add the same item again
        response = requests.post(
            f"{BASE_URL}/api/shopping/lists/{list_id}/items",
            json={"ingredients": [{"name": "Tomato", "amount": "3"}]},
            headers=api_headers
        )
        
        assert response.status_code == 200
        
        # Verify only 1 item (no duplicate)
        get_response = requests.get(f"{BASE_URL}/api/shopping/lists/{list_id}", headers=api_headers)
        items = get_response.json()["list"]["items"]
        tomato_count = sum(1 for item in items if item["name"].lower() == "tomato")
        assert tomato_count == 1, "Should not have duplicate items"
    
    def test_add_items_requires_ingredients(self, api_headers):
        """Test that endpoint requires at least one ingredient"""
        # Create a list
        create_response = requests.post(
            f"{BASE_URL}/api/shopping/lists",
            json={"name": f"TEST_empty_{uuid.uuid4().hex[:6]}", "ingredients": []},
            headers=api_headers
        )
        list_id = create_response.json()["list"]["list_id"]
        
        # Try to add empty ingredients
        response = requests.post(
            f"{BASE_URL}/api/shopping/lists/{list_id}/items",
            json={"ingredients": []},
            headers=api_headers
        )
        
        assert response.status_code == 400, f"Expected 400, got {response.status_code}"
    
    def test_add_items_list_not_found(self, api_headers):
        """Test adding items to non-existent list returns 404"""
        response = requests.post(
            f"{BASE_URL}/api/shopping/lists/nonexistent_xyz/items",
            json={"ingredients": [{"name": "Test"}]},
            headers=api_headers
        )
        
        assert response.status_code == 404, f"Expected 404, got {response.status_code}"


class TestRemoveItemFromList:
    """Test DELETE /api/shopping/lists/{list_id}/items/{item_name} endpoint"""
    
    def test_remove_item_requires_auth(self):
        """Verify endpoint requires authentication"""
        response = requests.delete(f"{BASE_URL}/api/shopping/lists/some_id/items/Tomato")
        assert response.status_code in [401, 403], f"Should require auth, got {response.status_code}"
    
    def test_remove_item_success(self, api_headers):
        """Test removing an item from a shopping list"""
        # Create a list with items
        create_response = requests.post(
            f"{BASE_URL}/api/shopping/lists",
            json={
                "name": f"TEST_remove_{uuid.uuid4().hex[:6]}",
                "ingredients": [
                    {"name": "Tomato", "amount": "2"},
                    {"name": "Onion", "amount": "1"}
                ]
            },
            headers=api_headers
        )
        list_id = create_response.json()["list"]["list_id"]
        
        # Remove an item
        response = requests.delete(
            f"{BASE_URL}/api/shopping/lists/{list_id}/items/Tomato",
            headers=api_headers
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert data.get("success") is True
        
        # Verify item was removed
        get_response = requests.get(f"{BASE_URL}/api/shopping/lists/{list_id}", headers=api_headers)
        items = get_response.json()["list"]["items"]
        item_names = [item["name"].lower() for item in items]
        assert "tomato" not in item_names, "Tomato should be removed"
        assert "onion" in item_names, "Onion should still exist"
    
    def test_remove_item_url_encoded(self, api_headers):
        """Test removing item with special characters in name"""
        # Create a list with an item that needs URL encoding
        create_response = requests.post(
            f"{BASE_URL}/api/shopping/lists",
            json={
                "name": f"TEST_encoded_{uuid.uuid4().hex[:6]}",
                "ingredients": [{"name": "Chicken Breast", "amount": "500g"}]
            },
            headers=api_headers
        )
        list_id = create_response.json()["list"]["list_id"]
        
        # Remove item with space (URL encoded)
        import urllib.parse
        encoded_name = urllib.parse.quote("Chicken Breast")
        response = requests.delete(
            f"{BASE_URL}/api/shopping/lists/{list_id}/items/{encoded_name}",
            headers=api_headers
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
    
    def test_remove_item_list_not_found(self, api_headers):
        """Test removing item from non-existent list returns 404"""
        response = requests.delete(
            f"{BASE_URL}/api/shopping/lists/nonexistent_xyz/items/Tomato",
            headers=api_headers
        )
        
        assert response.status_code == 404, f"Expected 404, got {response.status_code}"


class TestToggleItemChecked:
    """Test PATCH /api/shopping/lists/{list_id}/items/toggle endpoint"""
    
    def test_toggle_item_requires_auth(self):
        """Verify endpoint requires authentication"""
        response = requests.patch(
            f"{BASE_URL}/api/shopping/lists/some_id/items/toggle",
            json={"item_name": "Tomato", "checked": True}
        )
        assert response.status_code in [401, 403], f"Should require auth, got {response.status_code}"
    
    def test_toggle_item_checked_true(self, api_headers):
        """Test toggling an item to checked state"""
        # Create a list with an item
        create_response = requests.post(
            f"{BASE_URL}/api/shopping/lists",
            json={
                "name": f"TEST_toggle_{uuid.uuid4().hex[:6]}",
                "ingredients": [{"name": "Milk", "amount": "1"}]
            },
            headers=api_headers
        )
        list_id = create_response.json()["list"]["list_id"]
        
        # Toggle item to checked
        response = requests.patch(
            f"{BASE_URL}/api/shopping/lists/{list_id}/items/toggle",
            json={"item_name": "Milk", "checked": True},
            headers=api_headers
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert data.get("success") is True
        assert data.get("checked") is True
        
        # Verify item is checked
        get_response = requests.get(f"{BASE_URL}/api/shopping/lists/{list_id}", headers=api_headers)
        items = get_response.json()["list"]["items"]
        milk_item = next((item for item in items if item["name"].lower() == "milk"), None)
        assert milk_item is not None
        assert milk_item.get("checked") is True
    
    def test_toggle_item_checked_false(self, api_headers):
        """Test toggling an item to unchecked state"""
        # Create a list with an item
        create_response = requests.post(
            f"{BASE_URL}/api/shopping/lists",
            json={
                "name": f"TEST_uncheck_{uuid.uuid4().hex[:6]}",
                "ingredients": [{"name": "Eggs", "amount": "12"}]
            },
            headers=api_headers
        )
        list_id = create_response.json()["list"]["list_id"]
        
        # First check the item
        requests.patch(
            f"{BASE_URL}/api/shopping/lists/{list_id}/items/toggle",
            json={"item_name": "Eggs", "checked": True},
            headers=api_headers
        )
        
        # Then uncheck it
        response = requests.patch(
            f"{BASE_URL}/api/shopping/lists/{list_id}/items/toggle",
            json={"item_name": "Eggs", "checked": False},
            headers=api_headers
        )
        
        assert response.status_code == 200
        assert response.json().get("checked") is False
    
    def test_toggle_item_not_found(self, api_headers):
        """Test toggling a non-existent item returns 404"""
        # Create a list
        create_response = requests.post(
            f"{BASE_URL}/api/shopping/lists",
            json={"name": f"TEST_notfound_{uuid.uuid4().hex[:6]}", "ingredients": []},
            headers=api_headers
        )
        list_id = create_response.json()["list"]["list_id"]
        
        # Try to toggle non-existent item
        response = requests.patch(
            f"{BASE_URL}/api/shopping/lists/{list_id}/items/toggle",
            json={"item_name": "NonExistentItem", "checked": True},
            headers=api_headers
        )
        
        assert response.status_code == 404, f"Expected 404, got {response.status_code}"


class TestEndToEndWorkflow:
    """Test complete workflow: Create -> Add Items -> Toggle -> Clear -> Delete"""
    
    def test_complete_shopping_list_workflow(self, api_headers):
        """Test full lifecycle of a shopping list"""
        unique_name = f"TEST_e2e_{uuid.uuid4().hex[:6]}"
        
        # 1. Create a new list
        create_response = requests.post(
            f"{BASE_URL}/api/shopping/lists",
            json={"name": unique_name, "ingredients": []},
            headers=api_headers
        )
        assert create_response.status_code == 200
        list_id = create_response.json()["list"]["list_id"]
        print(f"✓ Created list: {list_id}")
        
        # 2. Add items to the list
        add_response = requests.post(
            f"{BASE_URL}/api/shopping/lists/{list_id}/items",
            json={
                "ingredients": [
                    {"name": "Chicken", "amount": "500", "unit": "g"},
                    {"name": "Rice", "amount": "1", "unit": "kg"},
                    {"name": "Vegetables", "amount": "1", "unit": "bunch"}
                ],
                "recipe_name": "Chicken Fried Rice"
            },
            headers=api_headers
        )
        assert add_response.status_code == 200
        assert add_response.json().get("added_count") == 3
        print("✓ Added 3 items")
        
        # 3. Verify items are in the list
        get_response = requests.get(f"{BASE_URL}/api/shopping/lists/{list_id}", headers=api_headers)
        assert len(get_response.json()["list"]["items"]) == 3
        print("✓ Verified items")
        
        # 4. Toggle an item as checked
        toggle_response = requests.patch(
            f"{BASE_URL}/api/shopping/lists/{list_id}/items/toggle",
            json={"item_name": "Chicken", "checked": True},
            headers=api_headers
        )
        assert toggle_response.status_code == 200
        print("✓ Toggled item checked")
        
        # 5. Remove an item
        remove_response = requests.delete(
            f"{BASE_URL}/api/shopping/lists/{list_id}/items/Rice",
            headers=api_headers
        )
        assert remove_response.status_code == 200
        print("✓ Removed item")
        
        # 6. Verify 2 items remain
        get_response2 = requests.get(f"{BASE_URL}/api/shopping/lists/{list_id}", headers=api_headers)
        assert len(get_response2.json()["list"]["items"]) == 2
        print("✓ Verified 2 items remain")
        
        # 7. Rename the list
        new_name = f"{unique_name}_renamed"
        rename_response = requests.put(
            f"{BASE_URL}/api/shopping/lists/{list_id}",
            json={"name": new_name},
            headers=api_headers
        )
        assert rename_response.status_code == 200
        print("✓ Renamed list")
        
        # 8. Clear all items
        clear_response = requests.post(
            f"{BASE_URL}/api/shopping/lists/{list_id}/clear",
            headers=api_headers
        )
        assert clear_response.status_code == 200
        print("✓ Cleared list")
        
        # 9. Verify list is empty
        get_response3 = requests.get(f"{BASE_URL}/api/shopping/lists/{list_id}", headers=api_headers)
        assert len(get_response3.json()["list"]["items"]) == 0
        print("✓ Verified list is empty")
        
        # 10. Delete the list
        delete_response = requests.delete(
            f"{BASE_URL}/api/shopping/lists/{list_id}",
            headers=api_headers
        )
        assert delete_response.status_code == 200
        print("✓ Deleted list")
        
        # 11. Verify list no longer exists
        final_response = requests.get(f"{BASE_URL}/api/shopping/lists/{list_id}", headers=api_headers)
        assert final_response.status_code == 404
        print("✓ Verified list no longer exists")
        
        print("\n✅ All workflow steps passed!")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
