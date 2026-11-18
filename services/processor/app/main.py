from fastapi import FastAPI
app = FastAPI(title="ToolNest internal processor", docs_url=None, redoc_url=None, openapi_url=None)
@app.get('/health')
def health(): return {'status':'ok'}
