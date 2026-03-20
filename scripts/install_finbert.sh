#!/bin/bash
# Install FinBERT dependencies for sentiment analysis

echo "╔══════════════════════════════════════════════════════════════════════════════╗"
echo "║                                                                              ║"
echo "║              Installing FinBERT for Sentiment Analysis                       ║"
echo "║                                                                              ║"
echo "╚══════════════════════════════════════════════════════════════════════════════╝"
echo ""

# Check if virtual environment is activated
if [[ -z "$VIRTUAL_ENV" ]]; then
    echo "⚠️  Warning: No virtual environment detected"
    echo "   Recommended: Activate venv first"
    echo "   $ cd backend && source .venv/bin/activate"
    echo ""
    read -p "Continue anyway? (y/n) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
fi

echo "📦 Installing transformers and dependencies..."
pip install transformers>=4.46.0 sentencepiece>=0.2.0

echo ""
echo "🤖 Downloading FinBERT model (ProsusAI/finbert)..."
echo "   This may take a few minutes (~500 MB)..."
python3 << 'EOF'
from transformers import AutoTokenizer, AutoModelForSequenceClassification
import torch

print("\n📥 Downloading tokenizer...")
tokenizer = AutoTokenizer.from_pretrained("ProsusAI/finbert")

print("📥 Downloading model...")
model = AutoModelForSequenceClassification.from_pretrained("ProsusAI/finbert")

print("\n✅ FinBERT model downloaded successfully!")
print(f"   Model size: ~{sum(p.numel() for p in model.parameters()) / 1e6:.1f}M parameters")
print(f"   GPU available: {torch.cuda.is_available()}")

# Test the model
print("\n🧪 Testing model...")
inputs = tokenizer("Stock prices surge on positive earnings report", return_tensors="pt", truncation=True, max_length=512)
with torch.no_grad():
    outputs = model(**inputs)
    predictions = torch.nn.functional.softmax(outputs.logits, dim=-1)
    probs = predictions[0].numpy()
    sentiment = probs[0] - probs[1]  # positive - negative
    print(f"   Test sentiment score: {sentiment:.3f} (positive)")

print("\n✨ FinBERT is ready to use!")
EOF

echo ""
echo "╔══════════════════════════════════════════════════════════════════════════════╗"
echo "║                                                                              ║"
echo "║                        ✅ Installation Complete ✅                           ║"
echo "║                                                                              ║"
echo "╚══════════════════════════════════════════════════════════════════════════════╝"
echo ""
echo "Next steps:"
echo "  1. Restart backend: uvicorn app.main:app --reload"
echo "  2. Test sentiment: curl http://localhost:8000/api/v1/sentiment/NSE_EQ%7CINE002A01018"
echo "  3. Run scanner with sentiment: POST /api/v1/scanner/scan"
echo ""
