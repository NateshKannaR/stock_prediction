from __future__ import annotations


def build_upstox_order_payload(
    instrument_token: str,
    quantity: int,
    transaction_type: str,
    order_type: str,
    product: str,
    validity: str,
) -> dict:
    return {
        "quantity": quantity,
        "product": product,
        "validity": validity,
        "price": 0,
        "tag": "benx-quant",
        "instrument_token": instrument_token,
        "order_type": order_type,
        "transaction_type": transaction_type,
        "disclosed_quantity": 0,
        "trigger_price": 0,
        "is_amo": False,
    }

