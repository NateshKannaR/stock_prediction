# Websocket Notes

The frontend subscribes to backend Socket.IO events. A production deployment should run a dedicated Socket.IO process backed by Redis pub/sub so multiple API instances can broadcast the same events.

Event names:

- `market.tick`
- `prediction.signal`
- `trade.executed`
- `risk.warning`

