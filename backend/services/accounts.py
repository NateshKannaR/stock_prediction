import hashlib
import uuid

from services.utils import iso_now

_USERS = {}
_TOKENS = {}
_WATCHLISTS = {}
_HISTORY = {}


def _hash_password(password):
    return hashlib.sha256(password.encode("utf-8")).hexdigest()


def register_user(email, password):
    if email in _USERS:
        return {"error": "User already exists"}
    _USERS[email] = {"email": email, "password": _hash_password(password), "created_at": iso_now()}
    _WATCHLISTS[email] = []
    _HISTORY[email] = []
    return {"email": email, "created_at": _USERS[email]["created_at"]}


def login_user(email, password):
    user = _USERS.get(email)
    if not user or user["password"] != _hash_password(password):
        return {"error": "Invalid credentials"}
    token = str(uuid.uuid4())
    _TOKENS[token] = email
    return {"token": token, "email": email}


def get_user_by_token(token):
    email = _TOKENS.get(token)
    return email


def get_watchlist(email):
    return _WATCHLISTS.get(email, [])


def add_watchlist(email, symbol):
    watchlist = _WATCHLISTS.setdefault(email, [])
    if symbol and symbol not in watchlist:
        watchlist.append(symbol)
    return watchlist


def add_history(email, payload):
    history = _HISTORY.setdefault(email, [])
    entry = {"created_at": iso_now(), **payload}
    history.append(entry)
    return entry


def get_history(email):
    return _HISTORY.get(email, [])
