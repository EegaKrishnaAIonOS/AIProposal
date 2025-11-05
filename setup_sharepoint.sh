#!/bin/bash

# SharePoint Integration Setup Script
# This script helps set up the SharePoint integration feature

echo "🚀 Starting SharePoint Integration Setup..."

# Check if .env file exists
if [ ! -f "backend/.env" ]; then
    echo "❌ Error: backend/.env file not found"
    echo "Please create .env file with required environment variables"
    exit 1
fi

# Check if environment variables are set
echo "📋 Checking environment variables..."

source backend/.env

required_vars=(
    "SHAREPOINT_CLIENT_ID"
    "SHAREPOINT_CLIENT_SECRET"
    "SHAREPOINT_TENANT_ID"
    "GROQ_API_KEY"
    "PINECONE_API_KEY"
    "PINECONE_INDEX_NAME"
)

missing_vars=()

for var in "${required_vars[@]}"; do
    if [ -z "${!var}" ]; then
        missing_vars+=("$var")
    fi
done

if [ ${#missing_vars[@]} -ne 0 ]; then
    echo "❌ Missing required environment variables:"
    for var in "${missing_vars[@]}"; do
        echo "   - $var"
    done
    exit 1
fi

echo "✅ All required environment variables are set"

# Install Python dependencies
echo "📦 Installing Python dependencies..."
cd backend
pip install python-pptx==0.6.23 openpyxl==3.1.5 PyMuPDF==1.24.11 msal==1.28.1

if [ $? -ne 0 ]; then
    echo "❌ Error: Failed to install dependencies"
    exit 1
fi

echo "✅ Dependencies installed successfully"

# Test SharePoint connection
echo "🔗 Testing SharePoint connection..."
python -c "
from sharepoint_client import get_sharepoint_client
try:
    client = get_sharepoint_client()
    token = client.get_access_token()
    if token:
        print('✅ SharePoint authentication successful')
    else:
        print('❌ SharePoint authentication failed')
        exit(1)
except Exception as e:
    print(f'❌ Error: {e}')
    exit(1)
"

if [ $? -ne 0 ]; then
    echo "❌ SharePoint connection test failed"
    echo "Please check your credentials in .env file"
    exit 1
fi

# Return to project root
cd ..

echo ""
echo "🎉 Setup completed successfully!"
echo ""
echo "Next steps:"
echo "1. Run initial sync: python backend/sharepoint_pipeline.py"
echo "2. Or use API: curl -X POST http://localhost:8000/api/sharepoint/sync/initial"
echo "3. Test generation with AIonOS Knowledge Base option"
echo ""
echo "For more information, see SHAREPOINT_INTEGRATION.md"

