from __future__ import annotations

import torch
from torch import nn


class LSTMClassifier(nn.Module):
    """Enhanced LSTM with attention mechanism for better predictions."""
    
    def __init__(self, input_size: int, hidden_size: int, num_layers: int, num_classes: int) -> None:
        super().__init__()
        
        # Bidirectional LSTM for better context
        self.lstm = nn.LSTM(
            input_size, 
            hidden_size, 
            num_layers, 
            batch_first=True, 
            dropout=0.3,
            bidirectional=True
        )
        
        # Attention mechanism
        self.attention = nn.Sequential(
            nn.Linear(hidden_size * 2, hidden_size),
            nn.Tanh(),
            nn.Linear(hidden_size, 1)
        )
        
        # Enhanced classifier with batch normalization
        self.classifier = nn.Sequential(
            nn.Linear(hidden_size * 2, hidden_size),
            nn.BatchNorm1d(hidden_size),
            nn.ReLU(),
            nn.Dropout(0.3),
            nn.Linear(hidden_size, hidden_size // 2),
            nn.BatchNorm1d(hidden_size // 2),
            nn.ReLU(),
            nn.Dropout(0.2),
            nn.Linear(hidden_size // 2, num_classes),
        )

    def forward(self, inputs: torch.Tensor) -> torch.Tensor:
        # LSTM output
        lstm_out, _ = self.lstm(inputs)  # (batch, seq, hidden*2)
        
        # Attention weights
        attention_weights = torch.softmax(self.attention(lstm_out), dim=1)  # (batch, seq, 1)
        
        # Weighted sum of LSTM outputs
        context = torch.sum(attention_weights * lstm_out, dim=1)  # (batch, hidden*2)
        
        # Classification
        return self.classifier(context)

