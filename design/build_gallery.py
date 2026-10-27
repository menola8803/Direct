# Bygger design/index.html (galleri). Kör: python3 design/build_gallery.py 0.4.0
import json,sys
v=sys.argv[1] if len(sys.argv)>1 else ""
c=json.load(open("design/canvas.json")); out=[]
for f in c["order"]:
    s=open("design/screens/"+f).read()
    inner=s[s.index("</helmet>")+9:s.index("</x-dc>")].strip()
    out.append(f'<figure><figcaption>{c["boards"][f]["title"]}</figcaption><div class="frame">{inner}</div></figure>')
html=f'''<!doctype html>
<html lang="sv"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Direct – skärmdesign v{v}</title>
<link href="https://fonts.googleapis.com/css2?family=Fraunces:wght@500;600&family=IBM+Plex+Sans:wght@400;500;600&display=swap" rel="stylesheet">
<style>body{{margin:0;padding:32px;background:#DAD6CC;font-family:'IBM Plex Sans',sans-serif}}h1{{font-family:'Fraunces',serif;margin:0 0 24px;color:#26231F}}
.grid{{display:flex;flex-wrap:wrap;gap:32px}}figure{{margin:0}}figcaption{{font-size:14px;font-weight:600;color:#4A453D;margin-bottom:8px}}
.frame{{width:390px;height:844px;border-radius:32px;overflow:hidden;box-shadow:0 20px 50px rgba(60,50,30,.25)}}button,input{{font-family:inherit}}</style></head>
<body><h1>Direct – skärmdesign <small style="font-size:16px;color:#6A6358">v{v}</small></h1><div class="grid">{"".join(out)}</div></body></html>'''
open("design/index.html","w").write(html)
