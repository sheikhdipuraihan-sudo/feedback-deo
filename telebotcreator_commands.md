# Feedback Deo Telegram bot commands

Bot: `@feedbackdeoBoT`

These commands are designed for TelebotCreator. The bot token stays inside TelebotCreator and is never sent to Feedback Deo.

## `/start`

Add a command named `/start`:

```python
link_token = str(params or '').strip()
if not link_token:
    bot.sendMessage("Welcome to Feedback Deo. Open the Connect Telegram link from your Pro café dashboard to connect this chat.")
    raise ReturnCommand

webhook_url = libs.Webhook.getUrlFor("notify_event", chat_id=message.chat.id)
response = HTTP.post(
    "https://feedback-deo.vercel.app/api/telegram/claim",
    json={
        "link_token": link_token,
        "chat_id": str(message.chat.id),
        "username": str(message.from_user.username or ""),
        "webhook_url": webhook_url,
    },
)

try:
    result = response.json()
except Exception:
    result = {}

if result.get("ok"):
    bot.sendMessage("Connected. This café will now receive new feedback, payment updates, and low-rating alerts here.")
else:
    bot.sendMessage(result.get("error", "That connection link is invalid or expired. Generate a new link in Feedback Deo."))
```

## `notify_event`

Add a command named `notify_event`:

```python
payload = options.get("json", {}) or {}
event = payload.get("event", "")
rating = payload.get("rating")
comment = payload.get("comment", "")
transaction_id = payload.get("transaction_id", "")
status = payload.get("status", "")

if event == "feedback":
    if rating is not None and int(rating) <= 2:
        bot.sendMessage(f"⚠️ Low-rating alert\nRating: {rating}/5\n\n{comment}")
    else:
        bot.sendMessage(f"New feedback: {rating}/5\n\n{comment}")
elif event == "payment_submitted":
    bot.sendMessage(f"Payment submitted for review\nTransaction: {transaction_id}")
elif event == "payment_updated":
    bot.sendMessage(f"Payment {status}\nTransaction: {transaction_id}")
```

## `help`

Add a command named `/help`:

```python
bot.sendMessage("Feedback Deo alerts are active in this chat. You will receive new feedback, payment updates, and low-rating alerts for your connected Pro café.")
```

## TelebotCreator setup

1. Open the bot in TelebotCreator.
2. Add the three commands above: `/start`, `notify_event`, and `/help`.
3. Save each command.
4. Start the bot.
5. In Feedback Deo, open the Pro dashboard and click **Connect Telegram**.
6. Click the generated **Open Telegram** link and press **Start**.

The `/start` command generates a chat-specific TelebotCreator webhook URL. Feedback Deo stores only that webhook URL and never stores the bot token.
