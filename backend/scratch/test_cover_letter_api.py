import asyncio
import httpx

async def test():
    async with httpx.AsyncClient(base_url='http://127.0.0.1:8000/api', timeout=60.0) as client:
        r = await client.post('/auth/login', json={'email': 'jobiss2002@gmail.com', 'password': 'Jobi@1234'})
        print('Login status:', r.status_code)
        if r.status_code != 200:
            print('Login error:', r.text)
            return
        token = r.json()['access_token']
        headers = {'Authorization': f'Bearer {token}'}

        rj = await client.get('/jobs?limit=5', headers=headers)
        print('Jobs status:', rj.status_code)
        jobs = rj.json().get('items', [])
        if not jobs:
            print('No jobs found')
            return
        job_id = jobs[0]['id']
        print(f"Testing job {job_id} title: {jobs[0]['title']}")

        rcl = await client.post(f'/jobs/{job_id}/generate-cover-letter', json={}, headers=headers, timeout=60.0)
        print('Generate cover letter status:', rcl.status_code)
        if rcl.status_code == 200:
            print('Success! CL id:', rcl.json().get('id'))
            print('Preview:\n', rcl.json().get('content')[:200])
        else:
            print('Error response:', rcl.text)

if __name__ == '__main__':
    asyncio.run(test())
