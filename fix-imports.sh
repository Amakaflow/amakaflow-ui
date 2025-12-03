#!/bin/bash
# Fix all version-specific imports in UI components

cd "$(dirname "$0")"

echo "Fixing version imports..."

# Fix all @radix-ui packages
for file in src/components/ui/*.tsx; do
  sed -i '' 's/@radix-ui\/react-dialog@[0-9.]*/@radix-ui\/react-dialog/g' "$file"
  sed -i '' 's/@radix-ui\/react-slot@[0-9.]*/@radix-ui\/react-slot/g' "$file"
  sed -i '' 's/@radix-ui\/react-tooltip@[0-9.]*/@radix-ui\/react-tooltip/g' "$file"
  sed -i '' 's/@radix-ui\/react-dropdown-menu@[0-9.]*/@radix-ui\/react-dropdown-menu/g' "$file"
  sed -i '' 's/@radix-ui\/react-select@[0-9.]*/@radix-ui\/react-select/g' "$file"
  sed -i '' 's/@radix-ui\/react-tabs@[0-9.]*/@radix-ui\/react-tabs/g' "$file"
  sed -i '' 's/@radix-ui\/react-aspect-ratio@[0-9.]*/@radix-ui\/react-aspect-ratio/g' "$file"
  sed -i '' 's/@radix-ui\/react-checkbox@[0-9.]*/@radix-ui\/react-checkbox/g' "$file"
  sed -i '' 's/@radix-ui\/react-toggle@[0-9.]*/@radix-ui\/react-toggle/g' "$file"
  sed -i '' 's/@radix-ui\/react-hover-card@[0-9.]*/@radix-ui\/react-hover-card/g' "$file"
  sed -i '' 's/@radix-ui\/react-alert-dialog@[0-9.]*/@radix-ui\/react-alert-dialog/g' "$file"
  sed -i '' 's/@radix-ui\/react-navigation-menu@[0-9.]*/@radix-ui\/react-navigation-menu/g' "$file"
  sed -i '' 's/@radix-ui\/react-slider@[0-9.]*/@radix-ui\/react-slider/g' "$file"
  sed -i '' 's/@radix-ui\/react-radio-group@[0-9.]*/@radix-ui\/react-radio-group/g' "$file"
  sed -i '' 's/@radix-ui\/react-label@[0-9.]*/@radix-ui\/react-label/g' "$file"
  sed -i '' 's/@radix-ui\/react-scroll-area@[0-9.]*/@radix-ui\/react-scroll-area/g' "$file"
  sed -i '' 's/@radix-ui\/react-toggle-group@[0-9.]*/@radix-ui\/react-toggle-group/g' "$file"
  sed -i '' 's/@radix-ui\/react-menubar@[0-9.]*/@radix-ui\/react-menubar/g' "$file"
  sed -i '' 's/@radix-ui\/react-accordion@[0-9.]*/@radix-ui\/react-accordion/g' "$file"
  sed -i '' 's/@radix-ui\/react-collapsible@[0-9.]*/@radix-ui\/react-collapsible/g' "$file"
  sed -i '' 's/@radix-ui\/react-progress@[0-9.]*/@radix-ui\/react-progress/g' "$file"
  sed -i '' 's/@radix-ui\/react-context-menu@[0-9.]*/@radix-ui\/react-context-menu/g' "$file"
  sed -i '' 's/@radix-ui\/react-popover@[0-9.]*/@radix-ui\/react-popover/g' "$file"
  
  # Fix other packages
  sed -i '' 's/class-variance-authority@[0-9.]*"/class-variance-authority"/g' "$file"
  sed -i '' 's/sonner@[0-9.]*"/sonner"/g' "$file"
  sed -i '' 's/recharts@[0-9.]*"/recharts"/g' "$file"
  sed -i '' 's/embla-carousel-react@[0-9.]*"/embla-carousel-react"/g' "$file"
  sed -i '' 's/vaul@[0-9.]*"/vaul"/g' "$file"
  sed -i '' 's/input-otp@[0-9.]*"/input-otp"/g' "$file"
  sed -i '' 's/cmdk@[0-9.]*"/cmdk"/g' "$file"
  sed -i '' 's/react-day-picker@[0-9.]*"/react-day-picker"/g' "$file"
  sed -i '' 's/react-hook-form@[0-9.]*"/react-hook-form"/g' "$file"
  sed -i '' 's/react-resizable-panels@[0-9.]*"/react-resizable-panels"/g' "$file"
done

# Fix Calendar.tsx
sed -i '' "s/from 'sonner@[0-9.]*'/from 'sonner'/g" src/components/Calendar.tsx

echo "Done! Checking for remaining version imports..."
count=$(grep -r "@[0-9]" src/components/ui/*.tsx src/components/Calendar.tsx 2>/dev/null | grep "from" | wc -l)
echo "Remaining version imports: $count"

if [ "$count" -eq "0" ]; then
  echo "✅ All version imports fixed!"
else
  echo "⚠️  Some imports may still need fixing"
  grep -r "@[0-9]" src/components/ui/*.tsx src/components/Calendar.tsx 2>/dev/null | grep "from"
fi
