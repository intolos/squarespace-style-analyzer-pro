#!/bin/bash
# verify-export-migration.sh
# Verifies that all export module files are properly migrated

echo "🔍 Verifying Export Module Migration..."
echo ""

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Counter
total=0
passed=0
failed=0

# Function to check file exists
check_file() {
    total=$((total + 1))
    if [ -f "$1" ]; then
        echo -e "${GREEN}✓${NC} $1"
        passed=$((passed + 1))
        return 0
    else
        echo -e "${RED}✗${NC} $1 (MISSING)"
        failed=$((failed + 1))
        return 1
    fi
}

echo "📁 Checking Core Export Files..."
check_file "src/export/index.ts"
check_file "src/export/csv.ts"
check_file "src/export/imagesReport.ts"
check_file "src/export/mobileReport.ts"
check_file "src/export/styleGuide.ts"
check_file "src/export/types.ts"
check_file "src/export/README.md"

echo ""
echo "📁 Checking Color Report Module..."
check_file "src/export/styleGuideColorsReport/index.ts"
check_file "src/export/styleGuideColorsReport/types.ts"
check_file "src/export/styleGuideColorsReport/analysis.ts"

echo ""
echo "📁 Checking Color Report Templates..."
check_file "src/export/styleGuideColorsReport/templates/styles.ts"
check_file "src/export/styleGuideColorsReport/templates/components.ts"
check_file "src/export/styleGuideColorsReport/templates/contrastChecker.ts"

echo ""
echo "📁 Checking Color Report Sections..."
check_file "src/export/styleGuideColorsReport/templates/sections/scoreCard.ts"
check_file "src/export/styleGuideColorsReport/templates/sections/issues.ts"
check_file "src/export/styleGuideColorsReport/templates/sections/colorFamilies.ts"
check_file "src/export/styleGuideColorsReport/templates/sections/outliers.ts"
check_file "src/export/styleGuideColorsReport/templates/sections/accessibility.ts"
check_file "src/export/styleGuideColorsReport/templates/sections/distribution.ts"

echo ""
echo "📁 Checking Documentation..."
check_file "EXPORT_MIGRATION_COMPLETE.md"
check_file "EXPORT_MIGRATION_STATUS.md"

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📊 Migration Verification Results"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo -e "Total files checked: ${YELLOW}$total${NC}"
echo -e "Passed: ${GREEN}$passed${NC}"
echo -e "Failed: ${RED}$failed${NC}"
echo ""

if [ $failed -eq 0 ]; then
    echo -e "${GREEN}✅ All files present! Migration is COMPLETE.${NC}"
    echo ""
    echo "Next steps:"
    echo "1. Run 'npm run build' to compile TypeScript"
    echo "2. Test the export functions"
    echo "3. Remove old JavaScript files when ready"
    exit 0
else
    echo -e "${RED}❌ Some files are missing. Please review the migration.${NC}"
    exit 1
fi
