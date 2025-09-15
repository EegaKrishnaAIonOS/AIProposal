import requests
fpath='uploads/test-upload.txt'
url='http://127.0.0.1:8000/api/upload-solution'
with open(fpath,'rb') as f:
    r=requests.post(url, files={'file':('test-upload.txt',f,'text/plain')}, headers={'X-User-Id':'demo-user'})
print(r.status_code)
print(r.text)
