import os, requests
from dotenv import load_dotenv

load_dotenv()
s = requests.Session()
s.auth = (os.getenv('JIRA_EMAIL'), os.getenv('JIRA_API_TOKEN'))
s.headers.update({'Accept':'application/json'})
s.verify = False
r = s.get(f"{os.getenv('JIRA_BASE_URL')}/rest/api/3/search/jql", params={'jql': 'project=ASK', 'fields': 'summary,status'})
print(r.status_code)
print(r.text[:500])
