from flask import Flask, jsonify, request
from flask_cors import CORS
import requests, os, time, json

app = Flask(__name__)
CORS(app)

# ARTSY_API_URL= "https://api.artsy.net/api/search"
# ARTSY_API_URL= "https://api.artsy.net/api/tokens/xapp_token"
# ARTSY_AUTH_ID= "54669836254db2195fbd"
# ARTSY_AUTH_SECRET= "e2d4bcdc59135170457c3760681a0a93"
ARTSY_API_URL = os.getenv("ARTSY_API_URL")
ARTSY_AUTH_URL = os.getenv("ARTSY_AUTH_URL")
ARTSY_AUTH_ID = os.getenv("ARTSY_AUTH_ID")
ARTSY_AUTH_SECRET = os.getenv("ARTSY_AUTH_SECRET")

class Auth:
    def __init__(self, token, expires_at):
        self.token = token
        self.expires_at = expires_at

    def is_token_valid(self):
        current_time = time.time()
        return current_time < self.expires_at

    def refresh_token(self, new_token, new_expires_at):
        self.token = new_token
        self.expires_at = new_expires_at

    def show(self):
        return {"Token": self.token, "Expires_at": self.expires_at}

token = "eyJhbGciOiJIUzI1NiJ9.eyJyb2xlcyI6IiIsInN1YmplY3RfYXBwbGljYXRpb24iOiI5Yzg1OTlhMi0wYjU3LTQwYjgtODlmZS00YzU1ZGZkYjdlN2UiLCJleHAiOjE3NDAyOTYxNTAsImlhdCI6MTczOTY5MTM1MCwiYXVkIjoiOWM4NTk5YTItMGI1Ny00MGI4LTg5ZmUtNGM1NWRmZGI3ZTdlIiwiaXNzIjoiR3Jhdml0eSIsImp0aSI6IjY3YjE5NTU2ZGQwYzc2NTcxOTVhNDgyMiJ9.hqTwKu0zLuAUVJwVeaGQU7lhJPsNWZyrfC_sTIOvNN8"
expires_at = 1739691407
auth = Auth(token, expires_at)

@app.route('/api/search', methods=['GET'])
def get_data():
    headers = {"X-XAPP-Token": get_token()}

    query = request.args.get('query', '').strip()
    if not query:
        return jsonify({"error": "Missing query parameter"}), 400
    
    params = {"q": query, "size": 10, "type": "artist"}

    response = requests.get(ARTSY_API_URL, headers=headers, params=params)

    if response.status_code == 200:
        return jsonify(response.json())
    else:
        return jsonify({"error": "Failed to fetch data", "status_code": response.status_code}), response.status_code
    
@app.route('/api/details', methods=['POST'])
def get_details():
    headers = {"X-XAPP-Token": get_token()}

    data = request.get_json()
    if not data or 'url' not in data:
        return jsonify({"error": "Missing 'url' parameter"}), 400
    detail_url = data['url']

    response = requests.get(detail_url, headers=headers)

    if response.status_code == 200:
        return jsonify(response.json())
    else:
        return jsonify({"error": "Failed to fetch data", "status_code": response.status_code}), response.status_code

def fetch_new_token(id, secret):
    params = {"client_id": id, "client_secret": secret}
    response = requests.post(ARTSY_AUTH_URL, params=params)
    
    if response.status_code == 200 or response.status_code == 201:
        data = response.json()
        ret_token = data.get("token")
        ret_expires_at = int(time.mktime(time.strptime(data.get("expires_at"), "%Y-%m-%dT%H:%M:%S+00:00")))
        return ret_token, ret_expires_at
    else:
        raise RuntimeError(f"Failed to fetch token: {response.status_code}, {response.text}")

def get_token():
    if not auth.is_token_valid():        
        token, expires_at = fetch_new_token(ARTSY_AUTH_ID, ARTSY_AUTH_SECRET)
        auth.refresh_token(token, expires_at)
        print("New token is generated!")
    return auth.token

@app.route('/api/show', methods=['get'])
def show_token():
    return auth.show()

if __name__ == '__main__':
    app.run(debug=True)