#!/bin/bash
# Script to clean up (delete all items from) MockAPI.io resources

BASE_URL="${MOCKAPI_BASE_URL:-https://6917363aa7a34288a27ff1d6.mockapi.io/api/v1}"

echo "=================================================================================="
echo "Cleaning up MockAPI.io Resources"
echo "=================================================================================="
echo "Base URL: $BASE_URL"
echo ""

# List of all resources
resources=(
    "health"
    "ingest_text"
    "ingest_ai_workout"
    "ingest_image"
    "ingest_url"
    "ingest_instagram_test"
    "ingest_youtube"
    "export_tp_text"
    "export_tcx"
)

cleanup_resource() {
    local resource_name=$1
    
    echo -n "Cleaning up '$resource_name'... "
    
    # Keep deleting until empty (in case there are many items)
    max_iterations=10
    iteration=0
    total_deleted=0
    
    while [ $iteration -lt $max_iterations ]; do
        # Get all items from the resource
        response=$(curl -s -w "\n%{http_code}" "$BASE_URL/$resource_name")
        http_code=$(echo "$response" | tail -n1)
        body=$(echo "$response" | sed '$d')
        
        if [ "$http_code" -ne 200 ]; then
            if [ $iteration -eq 0 ]; then
                echo "❌ Failed to fetch (HTTP $http_code)"
                return 1
            else
                break
            fi
        fi
        
        # Extract IDs more reliably - handle both "id":"123" and 'id':"123"
        # Also handle numeric IDs
        ids=$(echo "$body" | grep -oE '"id"\s*:\s*"?[0-9]+"?' | grep -oE '[0-9]+' || echo "")
        
        if [ -z "$ids" ]; then
            # Check if array is empty
            if [ "$body" = "[]" ]; then
                if [ $iteration -eq 0 ]; then
                    echo "✅ Already empty"
                else
                    echo "✅ Deleted $total_deleted item(s)"
                fi
                return 0
            else
                # No IDs found but body isn't empty - might be a parsing issue
                break
            fi
        fi
        
        # Delete each item by ID
        deleted_this_round=0
        for id in $ids; do
            # Only delete if id is not empty
            if [ -n "$id" ]; then
                delete_response=$(curl -s -w "\n%{http_code}" -X DELETE "$BASE_URL/$resource_name/$id")
                delete_code=$(echo "$delete_response" | tail -n1)
                
                if [ "$delete_code" -eq 200 ] || [ "$delete_code" -eq 404 ]; then
                    deleted_this_round=$((deleted_this_round + 1))
                    total_deleted=$((total_deleted + 1))
                fi
                # Delay to avoid rate limiting
                sleep 0.4
            fi
        done
        
        if [ $deleted_this_round -eq 0 ]; then
            # No items deleted this round, we're done
            break
        fi
        
        iteration=$((iteration + 1))
        # Wait between rounds
        sleep 1
    done
    
    if [ $total_deleted -gt 0 ]; then
        echo "✅ Deleted $total_deleted item(s)"
    else
        echo "⚠️  Cleanup may have failed or resource was empty"
    fi
}

# Clean up each resource
for resource in "${resources[@]}"; do
    cleanup_resource "$resource"
done

echo ""
echo "=================================================================================="
echo "✅ Cleanup complete!"
echo "=================================================================================="
echo ""
echo "You can now run the population script:"
echo "  bash scripts/create_mockapi_resources.sh"

