#!/bin/bash

# run-tests-ui.sh - Interactive Test Runner for Squarespace Style Analyzer Pro

# Colors for UI
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Ensure we are in the wxt-version directory
cd "$(dirname "$0")"

clear
echo -e "${BLUE}====================================================${NC}"
echo -e "${BLUE}   🎨 Squarespace Style Analyzer Pro - Test Runner  ${NC}"
echo -e "${BLUE}====================================================${NC}"
echo -e "Choose a test module to run:"
echo ""
echo -e "1) ${GREEN}⚡ @logic${NC}   - Fast logic tests (Calculations)"
echo -e "2) ${GREEN}🎨 @colors${NC}  - Color Style Guide Report"
echo -e "3) ${GREEN}📝 @content${NC} - Audit Report (Headings/Buttons/Layout)"
echo -e "4) ${GREEN}📱 @mobile${NC}  - Mobile Usability Report"
echo -e "5) ${GREEN}🖼️ @images${NC}  - Images Report"
echo -e "6) ${GREEN}🕸️ @domain${NC}  - Domain Analysis Report"
echo -e "7) ${GREEN}📄 @exports${NC} - All Export Formats (CSV/HTML/Guides)"
echo -e "8) ${YELLOW}🚀 ALL${NC}      - Run all tests"
echo -e "9) ${RED}❌ Exit${NC}"
echo ""

read -p "Enter Choice [1-9]: " choice

case $choice in
    1)
        echo -e "${BLUE}Running @logic tests...${NC}"
        npx vitest run
        ;;
    2)
        echo -e "${BLUE}Running @colors tests... (Colors Style Guide)${NC}"
        npx playwright test --grep @colors
        ;;
    3)
        echo -e "${BLUE}Running @content tests... (Audit Report)${NC}"
        npx playwright test --grep @content
        ;;
    4)
        echo -e "${BLUE}Running @mobile tests... (Mobile Usability Report)${NC}"
        npx playwright test --grep @mobile
        ;;
    5)
        echo -e "${BLUE}Running @images tests... (Images Report)${NC}"
        npx playwright test --grep @images
        ;;
    6)
        echo -e "${BLUE}Running @domain tests... (Domain Analysis Report)${NC}"
        npx playwright test --grep @domain
        ;;
    7)
        echo -e "${BLUE}Running @exports tests... (All Export Formats)${NC}"
        npx playwright test --grep @exports
        ;;
    8)
        echo -e "${BLUE}Running ALL tests...${NC}"
        npm run test:logic && npx playwright test
        ;;
    9)
        echo "Exiting..."
        exit 0
        ;;
    *)
        echo -e "${RED}Invalid choice!${NC}"
        exit 1
        ;;
esac

# Check if Playwright report exists and offer to open it
if [ -d "playwright-report" ]; then
    echo ""
    echo -e "${YELLOW}Playwright results are ready.${NC}"
    read -p "Open HTML report? (y/n): " open_report
    if [[ $open_report == "y" || $open_report == "Y" ]]; then
        npx playwright show-report
    fi
fi
