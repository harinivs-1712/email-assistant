from pymongo import MongoClient

db = MongoClient('mongodb://localhost:27017/')['email_assistant']

conv = db.agent_conversations.find_one(sort=[('updated_at', -1)])
if conv:
    print('=== LATEST CONVERSATION ===')
    print('ID:', conv['conversation_id'])
    print('Title:', conv.get('title'))
    for msg in conv.get('messages', []):
        print(f"[{msg['role']}]: {msg['content']}")
        if msg.get('tool_calls'):
            print('  -> tool_calls:', msg['tool_calls'])
        if msg.get('tool_results'):
            print('  -> tool_results count:', len(msg['tool_results']))

print('\n=== LATEST EXECUTION LOGS ===')
for log in db.agent_execution_logs.find().sort('timestamp', -1).limit(6):
    print(f"[{log.get('timestamp')}] {log.get('tool_name')} - status: {log.get('lifecycle_status')} ({log.get('arguments')})")
