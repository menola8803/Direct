import json
BG,CARD,CHIP,BEI,LINE,INK,MUT,ACC,DK,GRN,RED="#EFEDE8","#FAF8F4","#E9E2D3","#DCCBA8","#DDD8CD","#26231F","#6A6358","#7A5C2B","#26231F","#2F6E4C","#A8403A"
HF="font-family:'Fraunces',serif;font-weight:600"
SH="box-shadow:0 1px 0 #fff inset,0 10px 28px rgba(70,55,25,.07)"
CR="#F3E9D2"
P={"call":'<path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/>',
"video":'<rect x="1" y="5" width="15" height="14" rx="3"/><path d="M23 7l-7 5 7 5z"/>',
"group":'<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>',
"lock":'<rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>',
"chat":'<path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12z"/>',
"gear":'<path d="M4 6h10M18 6h2M4 12h4M12 12h8M4 18h12M20 18h0"/><circle cx="16" cy="6" r="2"/><circle cx="10" cy="12" r="2"/><circle cx="18" cy="18" r="2"/>',
"send":'<path d="M22 2L11 13M22 2l-7 20-4-9-9-4z"/>',
"clip":'<path d="M21 12l-8.5 8.5a5 5 0 0 1-7-7L14 5a3.5 3.5 0 0 1 5 5l-8.5 8.5a2 2 0 0 1-3-3L15 8"/>',
"mic":'<rect x="9" y="2" width="6" height="12" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v4"/>',
"micoff":'<rect x="9" y="2" width="6" height="12" rx="3"/><path d="M5 11a7 7 0 0 0 11 5.5M12 18v4M2 2l20 20"/>',
"end":'<g transform="rotate(135 12 12)"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></g>',
"check":'<path d="M20 6L9 17l-5-5"/>',"clock":'<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
"back":'<path d="M15 18l-6-6 6-6"/>',"next":'<path d="M9 18l6-6-6-6"/>',"key":'<circle cx="8" cy="15" r="4"/><path d="M11 12l9-9M16 7l3 3"/>',
"search":'<circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/>',
"file":'<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/>',
"image":'<rect x="3" y="3" width="18" height="18" rx="3"/><circle cx="9" cy="9" r="2"/><path d="M21 15l-5-5L5 21"/>',
"trash":'<path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6M10 11v6M14 11v6"/>',
"play":'<path d="M7 4l13 8-13 8z" fill="currentColor"/>',"stop":'<rect x="6" y="6" width="12" height="12" rx="2" fill="currentColor"/>',
"dot":'<circle cx="12" cy="12" r="8" fill="currentColor"/>',
"folder":'<path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>',
"shield":'<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>',
"warn":'<path d="M10.3 3.9L1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0zM12 9v4M12 17h.01"/>',
"eyeoff":'<path d="M17.9 17.9A10.1 10.1 0 0 1 12 20c-7 0-11-8-11-8a18 18 0 0 1 5.1-5.9M9.9 4.2A9 9 0 0 1 12 4c7 0 11 8 11 8a18 18 0 0 1-2.2 3.2M1 1l22 22"/>',
"flip":'<path d="M23 4v6h-6M1 20v-6h6"/><path d="M3.5 9a9 9 0 0 1 14.8-3.4L23 10M1 14l4.7 4.4A9 9 0 0 0 20.5 15"/>',
"broom":'<path d="M3 21l6-6M9 15l6-9 3 3-9 6zM15 6l3-3 3 3-3 3"/>'}
def ic(k,s=22,c="currentColor"): return f'<svg width="{s}" height="{s}" viewBox="0 0 24 24" fill="none" stroke="{c}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">{P[k]}</svg>'
def page(title,body):
    return f'''<!doctype html>
<html lang="sv"><head><meta charset="utf-8"><title>{title}</title><script src="./support.js"></script></head>
<body><x-dc><helmet>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Fraunces:wght@500;600&amp;family=IBM+Plex+Sans:wght@400;500;600&amp;display=swap" rel="stylesheet">
<style>body{{margin:0;background:{BG}}}button,input{{font-family:inherit}}</style></helmet>
<div style="width:390px;height:844px;box-sizing:border-box;background:{BG};color:{INK};font-family:'IBM Plex Sans',sans-serif;display:flex;flex-direction:column;padding:52px 16px 24px;gap:14px;overflow:hidden">
{body}
</div></x-dc>
<script type="text/x-dc" data-dc-script data-props='{{"$preview":{{"width":390,"height":844}}}}'>
class Component extends DCLogic {{ renderVals() {{ return {{}}; }} }}
</script></body></html>'''
def av(n,s=44,ring=LINE): return f'<div style="width:{s+8}px;height:{s+8}px;border-radius:50%;border:2px solid {ring};display:flex;align-items:center;justify-content:center;flex:none"><div style="width:{s}px;height:{s}px;border-radius:50%;background:{CHIP};color:{ACC};display:flex;align-items:center;justify-content:center;{HF};font-size:{s//3}px">{n}</div></div>'
def ib(k,label,c=ACC): return f'<button aria-label="{label}" style="width:44px;height:44px;flex:none;border-radius:14px;border:1px solid {LINE};background:{CARD};color:{c};display:flex;align-items:center;justify-content:center;{SH}">{ic(k)}</button>'
def ghost(k,label): return f'<button aria-label="{label}" style="width:40px;height:40px;flex:none;border-radius:12px;border:none;background:{CHIP};color:{ACC};display:flex;align-items:center;justify-content:center">{ic(k,18)}</button>'
def card(i,x="",g=12): return f'<div style="background:{CARD};border:1px solid {LINE};border-radius:22px;padding:16px;display:flex;flex-direction:column;gap:{g}px;{SH};{x}">{i}</div>'
lab=lambda t,c=ACC: f'<div style="font-size:12px;font-weight:600;letter-spacing:1.2px;text-transform:uppercase;color:{c}">{t}</div>'
def btn(t,k=None,kind="p"):
    st={"p":f"background:{DK};color:{CR};border:none;box-shadow:0 10px 24px rgba(38,35,31,.18)","s":f"background:{CARD};color:{INK};border:1px solid {LINE}","d":f"background:{RED};color:#fff;border:none","dg":f"background:{CARD};color:{RED};border:1px solid {RED}"}[kind]
    return f'<button style="{st};width:100%;min-height:52px;border-radius:16px;font-size:16px;font-weight:600;display:flex;align-items:center;justify-content:center;gap:10px">{ic(k) if k else ""}{t}</button>'
def tabs(a):
    o=''.join(f'<div style="flex:1;display:flex;flex-direction:column;align-items:center;gap:4px;padding:8px 0;font-size:12px;font-weight:600;color:{DK if t==a else MUT};{"background:"+CHIP+";border-radius:16px" if t==a else ""}">{ic(k,20)}{t}</div>' for t,k in [("Chattar","chat"),("Kontakter","group"),("Inställningar","gear")])
    return f'<div style="display:flex;gap:4px;background:{CARD};border:1px solid {LINE};border-radius:22px;padding:6px;{SH}">{o}</div>'
def wave(n=22,w=120,played=0.6,big=False):
    hs=[6,12,20,10,24,14,8,18,22,10,16,6,12,8,20,14,24,10,16,8,18,12,6,14,20,10,22,8,16,12][:n]
    H=56 if big else 28; sc=2 if big else 1
    return f'<svg width="{w}" height="{H}" viewBox="0 0 {n*5} 28" preserveAspectRatio="none" aria-hidden="true">'+''.join(f'<rect x="{i*5}" y="{14-h/2}" width="3" height="{h}" rx="1.5" fill="{ACC if i<n*played else "#A39A87"}"/>' for i,h in enumerate(hs))+'</svg>'
back=lambda: ib("back","Tillbaka",MUT)
hdr=lambda t,s="": f'<div style="display:flex;align-items:center;gap:12px">{back()}<div><div style="{HF};font-size:22px;letter-spacing:-0.3px">{t}</div>'+(f'<div style="font-size:14px;color:{MUT}">{s}</div>' if s else '')+'</div></div>'
sq=lambda k,bg=CHIP,c=ACC,s=40: f'<div style="width:{s}px;height:{s}px;border-radius:12px;background:{bg};color:{c};display:flex;align-items:center;justify-content:center;flex:none">{ic(k,20)}</div>'
F={}
# 1 Välkomst
hero=f'''<svg width="358" height="150" viewBox="0 0 358 150" aria-hidden="true"><line x1="76" y1="75" x2="282" y2="75" stroke="{ACC}" stroke-width="2" stroke-dasharray="1 9" stroke-linecap="round"/>
<circle cx="52" cy="75" r="38" fill="{CARD}" stroke="{LINE}" stroke-width="2"/><circle cx="306" cy="75" r="38" fill="{CARD}" stroke="{LINE}" stroke-width="2"/>
<text x="52" y="83" text-anchor="middle" font-family="Fraunces" font-weight="600" font-size="22" fill="{ACC}">Du</text><text x="306" y="83" text-anchor="middle" font-family="Fraunces" font-weight="600" font-size="22" fill="{ACC}">AL</text>
<circle cx="179" cy="75" r="26" fill="{DK}"/><g transform="translate(167 63)" fill="none" stroke="{CR}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">{P["lock"]}</g></svg>'''
F["Main"]=("1 Välkomst",f'''<div style="display:flex;align-items:center;gap:10px;padding:0 4px"><div style="width:34px;height:34px;border-radius:11px;background:{DK};color:{CR};display:flex;align-items:center;justify-content:center;{HF};font-size:20px">D</div><div style="{HF};font-size:24px;letter-spacing:-0.4px">Direct</div></div>
<div style="padding-top:8px">{hero}</div>
<div style="padding:4px 4px 0;display:flex;flex-direction:column;gap:12px"><h1 style="{HF};margin:0;font-size:36px;line-height:1.1;letter-spacing:-0.8px">Chatta direkt.<br><span style="color:{ACC}">Ingen server emellan.</span></h1>
<p style="margin:0;font-size:15px;line-height:1.55;color:{MUT}">Din identitet är en nyckel som skapas på din telefon. Kontakterna matchas lokalt och laddas aldrig upp.</p></div>
<div style="flex:1"></div>
{card(f'<label for="nr" style="font-size:14px;font-weight:600">Ditt telefonnummer</label><input id="nr" value="+46 70 123 45 67" style="box-sizing:border-box;height:52px;border:1px solid {LINE};border-radius:14px;padding:0 16px;font-size:17px;background:{BG};color:{INK};letter-spacing:.3px"><div style="font-size:13px;line-height:1.5;color:{MUT}">Numret används bara för att andra ska hitta dig. Det verifieras inte via SMS.</div>')}
{btn("Skapa min nyckel","key")}''')
# 2 Kontakter
def crow(n,i,sub,right,ring=LINE): return f'<div style="display:flex;align-items:center;gap:12px">{av(i,44,ring)}<div style="flex:1;min-width:0"><div style="font-size:16px;font-weight:600">{n}</div><div style="font-size:13px;color:{MUT}">{sub}</div></div>{right}</div>'
act=f'<div style="display:flex;gap:8px">{ghost("call","Ring")}{ghost("video","Video")}</div>'
inv=f'<button style="min-height:44px;padding:0 16px;border-radius:12px;border:1px solid {ACC};background:{CHIP};color:{ACC};font-size:14px;font-weight:600">Bjud in</button>'
off=f'<span style="font-size:13px;font-weight:600;color:{MUT}">Offline</span>'
F["Kontakter"]=("2 Kontakter",f'''<div style="display:flex;align-items:flex-start;gap:12px"><div style="flex:1"><div style="{HF};font-size:28px;letter-spacing:-0.5px">Kontakter</div><div style="font-size:14px;color:{MUT};margin-top:2px">Matchas lokalt på din telefon</div></div>{ib("group","Starta videokonferens")}</div>
<div style="display:flex;align-items:center;gap:10px;height:48px;padding:0 16px;border-radius:14px;background:{CARD};border:1px solid {LINE};color:{MUT};font-size:15px">{ic("search",18)}Sök bland kontakter</div>
{card(lab("I appen · 4")+crow("Anna Lindqvist","AL","+46 70 *** ** 21",act,GRN)+crow("Erik Sundberg","ES","+46 73 *** ** 48",act,GRN)+crow("Lisa Ek","LE","+46 72 *** ** 63",act,GRN)+crow("Maja Holm","MH","+46 76 *** ** 05",off),"",14)}
{card(lab("Bjud in · 2")+crow("Johan Berg","JB","Har inte appen",inv)+crow("Sara Nilsson","SN","Har inte appen",inv),"",14)}
<div style="flex:1"></div>{tabs("Kontakter")}''')
# 3 Chatt
def bub(t,me,meta,pend=False):
    r="18px 18px 6px 18px" if me else "18px 18px 18px 6px"
    st=f"background:transparent;color:{INK};border:1px dashed {ACC}" if pend else (f"background:{BEI};color:{INK};border:1px solid {BEI}" if me else f"background:{CARD};color:{INK};border:1px solid {LINE}")
    mi=ic("clock",13,ACC) if pend else (ic("check",13,ACC) if me else "")
    return f'<div style="display:flex;flex-direction:column;align-items:{"flex-end" if me else "flex-start"};gap:4px"><div style="max-width:272px;padding:10px 14px;border-radius:{r};{st};font-size:15px;line-height:1.45">{t}</div>{meta_(meta,mi)}</div>'
meta_=lambda m,i="": f'<div style="display:flex;align-items:center;gap:4px;font-size:12px;color:{MUT}">{i}{m}</div>'
pill=lambda i,t: f'<div style="align-self:center;display:flex;align-items:center;gap:6px;padding:5px 12px;border-radius:999px;background:{CHIP};font-size:12px;color:{MUT}">{i}{t}</div>'
voice=f'<div style="display:flex;flex-direction:column;align-items:flex-end;gap:4px"><div style="display:flex;align-items:center;gap:10px;padding:10px 14px 10px 10px;border-radius:18px 18px 6px 18px;background:{BEI}"><div style="width:36px;height:36px;border-radius:50%;background:{DK};color:{CR};display:flex;align-items:center;justify-content:center">{ic("play",16)}</div>{wave(22,120,.55)}<span style="font-size:13px;font-weight:600">0:24</span></div>{meta_("14:04 · Sparad krypterat",ic("check",13,ACC))}</div>'
vid=f'<div style="display:flex;flex-direction:column;align-items:flex-start;gap:4px"><div style="position:relative;width:210px;height:140px;border-radius:18px 18px 18px 6px;background:#3A342C;display:flex;align-items:center;justify-content:center;color:{CR}"><div style="width:48px;height:48px;border-radius:50%;background:rgba(250,248,244,.18);border:1px solid rgba(250,248,244,.4);display:flex;align-items:center;justify-content:center">{ic("play",22)}</div><div style="position:absolute;left:10px;bottom:10px;padding:3px 9px;border-radius:999px;background:rgba(0,0,0,.45);font-size:12px;font-weight:600">Videomeddelande · 0:18</div></div>{meta_("14:05 · Sparad krypterat")}</div>'
filec=f'<div style="display:flex;flex-direction:column;align-items:flex-end;gap:4px"><div style="display:flex;align-items:center;gap:12px;padding:10px 14px 10px 10px;border-radius:18px 18px 6px 18px;background:{CARD};border:1px solid {LINE}">{sq("file")}<div><div style="font-size:14px;font-weight:600">Offert_oktober.pdf</div><div style="font-size:12px;color:{MUT}">2,4 MB · PDF</div></div></div>{meta_("14:06 · Levererat",ic("check",13,ACC))}</div>'
F["Chatt"]=("3 Chatt",f'''<div style="display:flex;align-items:center;gap:8px">{back()}{av("AL",36,GRN)}
<div style="flex:1;min-width:0"><div style="{HF};font-size:18px">Anna Lindqvist</div><div style="font-size:12px;font-weight:600;color:{GRN}">Direkt · krypterad</div></div>{ib("call","Ring Anna")}{ib("video","Videosamtal med Anna")}</div>
<div style="flex:1;display:flex;flex-direction:column;gap:12px;padding-top:4px">
{pill(ic("lock",12,ACC),"Krypterad direkt mellan era telefoner")}
{bub("Hej! Hittade dig via kontaktlistan.",False,"14:02")}{voice}{vid}{filec}
{bub("Skickar fler filer när du är online.",True,"Väntar i utkorgen",True)}</div>
<div style="display:flex;gap:10px;align-items:center">{ib("clip","Dela fil",MUT)}<input aria-label="Meddelande" placeholder="Skriv ett meddelande" style="flex:1;min-width:0;box-sizing:border-box;height:48px;border:1px solid {LINE};border-radius:24px;padding:0 18px;font-size:15px;background:{CARD};color:{INK}"><button aria-label="Spela in röstmeddelande" style="width:48px;height:48px;flex:none;border-radius:50%;border:none;background:{DK};color:{CR};display:flex;align-items:center;justify-content:center;box-shadow:0 10px 24px rgba(38,35,31,.18)">{ic("mic",20)}</button></div>''')
# 4 Dela
def opt(k,t,s): return f'<button style="display:flex;flex-direction:column;align-items:flex-start;gap:10px;padding:14px;border-radius:18px;border:1px solid {LINE};background:{BG};text-align:left;color:{INK}">{sq(k,CARD)}<div><div style="font-size:15px;font-weight:600">{t}</div><div style="font-size:12px;color:{MUT};margin-top:2px">{s}</div></div></button>'
F["Dela"]=("4 Dela med kontakt",f'''<div style="flex:1;display:flex;align-items:center;justify-content:center;flex-direction:column;gap:8px;color:{MUT}">{av("AL",56)}<div style="font-size:14px">Chatt med Anna Lindqvist</div></div>
{card(f'<div style="width:40px;height:4px;border-radius:2px;background:{LINE};align-self:center"></div><div style="display:flex;justify-content:space-between;align-items:baseline"><div style="{HF};font-size:22px">Dela med Anna</div><div style="font-size:13px;color:{MUT}">Direkt, utan moln</div></div><div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">{opt("file","Fil","Dokument, zip, mer")}{opt("image","Foto","Från galleriet")}{opt("mic","Röstmeddelande","Spela in ljud")}{opt("video","Videomeddelande","Spela in video")}</div><div style="display:flex;gap:10px;font-size:13px;line-height:1.5;color:{MUT}">{ic("folder",18,ACC)}<span>Mottagna filer sparas krypterat i appen.</span></div>{btn("Avbryt",None,"s")}',"border-radius:28px 28px 22px 22px",14)}''')
# 5 Röst
F["Rost"]=("5 Röstmeddelande",f'''{hdr("Röstmeddelande","Till Anna Lindqvist")}
<div style="flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:22px">
<div style="display:flex;align-items:center;gap:8px;font-size:13px;font-weight:600;color:{RED}"><span style="width:10px;height:10px;border-radius:50%;background:{RED};display:inline-block"></span>Spelar in</div>
<div style="{HF};font-size:64px;letter-spacing:-2px">00:24</div>
<div style="width:100%;display:flex;justify-content:center">{wave(30,330,.7,True)}</div>
<div style="font-size:13px;color:{MUT};text-align:center">Dra åt vänster för att avbryta. Max 5 minuter.</div></div>
<div style="display:flex;align-items:center;justify-content:center;gap:28px">
<button aria-label="Radera" style="width:56px;height:56px;border-radius:50%;border:1px solid {LINE};background:{CARD};color:{MUT};display:flex;align-items:center;justify-content:center">{ic("trash",24)}</button>
<button aria-label="Stoppa inspelning" style="width:84px;height:84px;border-radius:50%;border:6px solid {BEI};background:{DK};color:{CR};display:flex;align-items:center;justify-content:center">{ic("stop",30)}</button>
<button aria-label="Skicka" style="width:56px;height:56px;border-radius:50%;border:none;background:{ACC};color:#fff;display:flex;align-items:center;justify-content:center">{ic("send",24)}</button></div>
{card(f'<div style="display:flex;gap:10px;align-items:center;font-size:13px;line-height:1.5;color:{MUT}">{ic("folder",20,ACC)}<span>Sparas som <b style="color:{INK}">.m4a</b> krypterat i appen</span></div>',"padding:12px 16px")}''')
# 6 Video
F["Videomeddelande"]=("6 Videomeddelande",f'''{hdr("Videomeddelande","Till Anna Lindqvist")}
<div style="position:relative;flex:1;border-radius:28px;background:#3A342C;overflow:hidden;display:flex;align-items:center;justify-content:center">
<div style="position:absolute;inset:18px;border-radius:18px;border:1px solid rgba(243,233,210,.25)"></div>
<div style="width:96px;height:96px;border-radius:50%;background:rgba(243,233,210,.1);color:{CR};display:flex;align-items:center;justify-content:center">{ic("video",40)}</div>
<div style="position:absolute;top:30px;left:30px;display:flex;align-items:center;gap:8px;padding:6px 12px;border-radius:999px;background:rgba(0,0,0,.45);color:{CR};font-size:13px;font-weight:600"><span style="width:8px;height:8px;border-radius:50%;background:#E8776D;display:inline-block"></span>00:12 / 01:00</div></div>
<div style="display:flex;align-items:center;justify-content:center;gap:28px">{ib("flip","Vänd kamera",MUT)}
<button aria-label="Stoppa inspelning" style="width:84px;height:84px;border-radius:50%;border:6px solid {BEI};background:{RED};color:#fff;display:flex;align-items:center;justify-content:center">{ic("stop",30)}</button>
<button aria-label="Skicka" style="width:56px;height:56px;border-radius:50%;border:none;background:{ACC};color:#fff;display:flex;align-items:center;justify-content:center">{ic("send",24)}</button></div>
{card(f'<div style="display:flex;gap:10px;align-items:center;font-size:13px;line-height:1.5;color:{MUT}">{ic("folder",20,ACC)}<span>Sparas som <b style="color:{INK}">.mp4</b> krypterat i appen</span></div>',"padding:12px 16px")}''')
# 7 Verifiera
codes=["48213","90571","33846","71209","56482","19035"]
cells=''.join(f'<div style="padding:12px 0;text-align:center;{HF};font-size:20px;letter-spacing:.08em">{c}</div>' for c in codes)
kv=lambda k,v: f'<div style="display:flex;justify-content:space-between;font-size:14px"><span style="color:{MUT}">{k}</span><span style="font-weight:600">{v}</span></div>'
def abtn(k,t): return f'<button style="flex:1;min-height:64px;border-radius:16px;border:1px solid {LINE};background:{CARD};color:{ACC};display:flex;flex-direction:column;align-items:center;justify-content:center;gap:6px;font-size:13px;font-weight:600;{SH}">{ic(k)}<span style="color:{INK}">{t}</span></button>'
F["Sakerhetskod"]=("7 Verifiera kontakt",f'''{hdr("Verifiera kontakt")}
<div style="display:flex;flex-direction:column;align-items:center;gap:8px">{av("AL",72,ACC)}<div style="{HF};font-size:24px;margin-top:4px">Anna Lindqvist</div><span style="font-size:12px;font-weight:600;color:{INK};background:{BEI};border-radius:999px;padding:3px 10px">Ej verifierad</span></div>
<div style="display:flex;gap:10px">{abtn("call","Ring")}{abtn("video","Video")}{abtn("group","Konferens")}</div>
{card(f'<div style="display:flex;align-items:center;gap:8px;color:{ACC}">{ic("key",18)}{lab("Säkerhetskod")}</div><div style="display:grid;grid-template-columns:1fr 1fr 1fr;background:{CHIP};border-radius:14px">{cells}</div><div style="font-size:14px;line-height:1.5;color:{MUT}">Läs upp koden för Anna eller skanna hennes QR-kod när ni ses. Är koderna lika är det verkligen hon.</div>')}
{card(kv("Anslutning","Direkt")+kv("Nyckel sedd första gången","12 okt 2026"))}
<div style="flex:1"></div>{btn("Markera som verifierad")}{btn("Blockera kontakt",None,"s")}''')
# 8 Videokonf val
def prow(n,i,sub,chk,dis=False): return f'<div style="display:flex;align-items:center;gap:12px;{"opacity:.65;" if dis else ""}">{av(i,40,LINE if dis else GRN)}<div style="flex:1"><div style="font-size:16px;font-weight:600">{n}</div><div style="font-size:13px;color:{ACC if dis else MUT}">{sub}</div></div><input type="checkbox" aria-label="{n}" {"checked" if chk else ""} {"disabled" if dis else ""} style="width:24px;height:24px;accent-color:{DK}"></div>'
seg=lambda: f'<div style="flex:1;height:6px;border-radius:3px;background:{ACC}"></div>'
F["Videokonferens"]=("8 Videokonferens",f'''{hdr("Ny videokonferens","Välj deltagare")}
{card(f'<div style="display:flex;justify-content:space-between;align-items:baseline">{lab("Deltagare med video")}<div style="{HF};font-size:28px">4 av 4</div></div><div style="display:flex;gap:6px">{seg()*4}</div><div style="font-size:13px;color:{MUT}">Du och 3 valda. Direktanslutning kräver max 4.</div>',"",10)}
{card(prow("Anna Lindqvist","AL","Online",1)+prow("Erik Sundberg","ES","Online",1)+prow("Maja Holm","MH","Offline · ringer upp via notis",1)+prow("Lisa Ek","LE","Max antal nått",0,True),"",14)}
{card(f'<div style="font-size:14px;line-height:1.5;color:{MUT}">Fler än 4 kan gå med bara ljud, upp till 8 personer. Video för fler kräver en mediaserver.</div><button style="min-height:44px;border-radius:12px;border:1px solid {ACC};background:{CHIP};color:{ACC};font-size:14px;font-weight:600">Lägg till med bara ljud</button>',"",10)}
<div style="flex:1"></div>{btn("Starta videokonferens","video")}''')
# 9 Konferens
def tile(n,i,speak=False,mute=False):
    b=f"2px solid {ACC}" if speak else f"1px solid {LINE}"
    m=f'<div style="position:absolute;top:10px;right:10px;width:30px;height:30px;border-radius:50%;background:{CARD};color:{RED};display:flex;align-items:center;justify-content:center">{ic("micoff",16)}</div>' if mute else ""
    return f'<div style="position:relative;height:236px;border-radius:22px;background:{CARD};border:{b};display:flex;align-items:center;justify-content:center;box-sizing:border-box;{SH}">{av(i,64,ACC if speak else LINE)}{m}<div style="position:absolute;left:10px;bottom:10px;padding:4px 10px;border-radius:999px;background:{CHIP};font-size:12px;font-weight:600">{n}</div></div>'
cb=lambda k,l,bg,c: f'<button aria-label="{l}" style="width:60px;height:60px;border-radius:50%;border:1px solid {LINE};background:{bg};color:{c};display:flex;align-items:center;justify-content:center">{ic(k,26)}</button>'
F["Samtal"]=("9 Pågående konferens",f'''<div style="display:flex;align-items:center;justify-content:space-between"><div style="{HF};font-size:24px;letter-spacing:-0.3px">Konferens</div>
<div style="display:flex;align-items:center;gap:6px;background:{CARD};border:1px solid {LINE};border-radius:999px;padding:6px 12px;font-size:13px;font-weight:600;color:{GRN}"><span style="width:8px;height:8px;border-radius:50%;background:{GRN};display:inline-block"></span>04:12 · krypterad</div></div>
<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">{tile("Anna","AL",True)}{tile("Erik","ES")}{tile("Maja","MH",False,True)}{tile("Du","Du")}</div>
{card(f'<div style="display:flex;align-items:center;gap:10px;font-size:13px;color:{MUT}">{ic("group",18,ACC)}Direktanslutning till 3 deltagare. Videon anpassas till 360p.</div>',"padding:12px 16px")}
<div style="flex:1"></div>
<div style="display:flex;justify-content:center;gap:18px">{cb("micoff","Stäng av mikrofon",CARD,INK)}{cb("video","Kamera",CARD,INK)}{cb("end","Lägg på",RED,"#fff")}</div>''')
# 10 Inställningar
def srow(k,t,s,r=None): return f'<div style="display:flex;align-items:center;gap:12px">{sq(k)}<div style="flex:1"><div style="font-size:16px;font-weight:600">{t}</div><div style="font-size:13px;color:{MUT}">{s}</div></div>{r or ic("next",18,MUT)}</div>'
F["Installningar"]=("10 Inställningar",f'''<div><div style="{HF};font-size:28px;letter-spacing:-0.5px">Inställningar</div><div style="font-size:14px;color:{MUT};margin-top:2px">Direct är gjord för att stanna hos dig</div></div>
{card(f'<div style="display:flex;align-items:center;gap:12px">{av("Du",44,ACC)}<div style="flex:1"><div style="font-size:16px;font-weight:600">Din nyckel</div><div style="font-size:13px;color:{MUT}">+46 70 123 45 67 · skapad 12 okt</div></div></div>',"",10)}
{card(srow("folder","Lagring och filer","1,8 GB i Download/Direct")+srow("key","Säkerhetskopiera nyckel","Behövs om du byter telefon")+srow("eyeoff","Synlighet","Vem som kan hitta dig","<span style='font-size:13px;font-weight:600;color:"+MUT+"'>Kontakter</span>"),"",16)}
{card(srow("shield","Om Direct och integritet","Så fungerar appen")+srow("lock","Notiser","Visa aldrig innehåll på låsskärmen"),"",16)}
<div style="flex:1"></div>{tabs("Inställningar")}''')
# 11 Lagring
def seg2(w,c): return f'<div style="flex:{w};height:10px;background:{c}"></div>'
def lg(c,t): return f'<span style="display:flex;align-items:center;gap:6px;font-size:12px;color:{MUT}"><span style="width:8px;height:8px;border-radius:50%;background:{c};display:inline-block"></span>{t}</span>'
def lrow(n,i,sub,sz,chk): return f'<div style="display:flex;align-items:center;gap:12px">{av(i,36)}<div style="flex:1;min-width:0"><div style="font-size:15px;font-weight:600">{n}</div><div style="font-size:12px;color:{MUT}">{sub}</div></div><div style="font-size:13px;font-weight:600">{sz}</div><input type="checkbox" aria-label="Välj {n}" {"checked" if chk else ""} style="width:24px;height:24px;accent-color:{DK}"></div>'
F["Lagring"]=("14 Lagring",f'''{hdr("Lagring","Filer från dina kontakter")}
{card(f'<div style="display:flex;justify-content:space-between;align-items:baseline">{lab("Totalt")}<div style="{HF};font-size:30px">1,8 GB</div></div><div style="display:flex;border-radius:5px;overflow:hidden;gap:2px">{seg2(18,DK)}{seg2(55,ACC)}{seg2(20,BEI)}{seg2(7,"#CFC8B8")}</div><div style="display:flex;gap:14px;flex-wrap:wrap">{lg(DK,"Ljud")}{lg(ACC,"Video")}{lg(BEI,"Filer")}{lg("#CFC8B8","Cache")}</div>',"",10)}
{card(f'<div style="display:flex;align-items:center;gap:12px">{sq("broom")}<div style="flex:1"><div style="font-size:15px;font-weight:600">Cache · 124 MB</div><div style="font-size:12px;color:{MUT}">Tillfälliga filer. Inga meddelanden tas bort.</div></div><button style="min-height:44px;padding:0 16px;border-radius:12px;border:1px solid {LINE};background:{CHIP};color:{INK};font-size:14px;font-weight:600">Rensa</button></div>',"padding:12px 16px")}
{card(lab("Rensa per kontakt")+lrow("Anna Lindqvist","AL","Ljud 120 MB · Video 640 MB · Filer 80 MB","840 MB",1)+lrow("Erik Sundberg","ES","Ljud 60 MB · Video 310 MB · Filer 20 MB","390 MB",1)+lrow("Lisa Ek","LE","Ljud 40 MB · Video 120 MB","160 MB",0)+lrow("Maja Holm","MH","Ljud 30 MB · Filer 260 MB","290 MB",0),"",12)}
<div style="flex:1"></div>
{btn("Rensa valda (2) · 1,2 GB","trash","dg")}
<button style="min-height:40px;border:none;background:transparent;color:{RED};font-size:14px;font-weight:600;text-decoration:underline">Rensa allt…</button>''')
# 12 Rensa allt
F["Rensa"]=("15 Rensa allt",f'''{hdr("Rensa allt")}
<div style="flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:14px;text-align:center;padding:0 8px"><div style="width:72px;height:72px;border-radius:50%;background:#F1DAD6;color:{RED};display:flex;align-items:center;justify-content:center">{ic("warn",34)}</div>
<h1 style="{HF};margin:0;font-size:30px;line-height:1.15">Rensa alla filer?</h1>
<p style="margin:0;font-size:15px;line-height:1.55;color:{MUT}">1,8 GB tas bort från Download/Direct för alla kontakter. Det går inte att ångra. Meddelanden i chattarna ligger kvar.</p></div>
{card(f'<label style="display:flex;gap:12px;align-items:flex-start;font-size:14px;line-height:1.5"><input type="checkbox" checked style="width:24px;height:24px;flex:none;accent-color:{DK}">Jag förstår att ljud, video och filer raderas från min telefon.</label><label for="ok" style="font-size:14px;font-weight:600">Skriv RENSA för att bekräfta</label><input id="ok" value="RENSA" style="box-sizing:border-box;height:52px;border:1px solid {LINE};border-radius:14px;padding:0 16px;font-size:17px;letter-spacing:2px;background:{BG};color:{INK}"><div style="font-size:13px;line-height:1.5;color:{MUT}">Tips: flytta filer du vill behålla ur mappen först.</div>')}
{btn("Rensa allt","trash","d")}{btn("Avbryt",None,"s")}''')
# 13 Om
def prin(k,t,s): return f'<div style="display:flex;gap:12px;align-items:flex-start">{sq(k)}<div><div style="font-size:15px;font-weight:600">{t}</div><div style="font-size:13px;line-height:1.5;color:{MUT};margin-top:2px">{s}</div></div></div>'
chip=lambda t: f'<span style="padding:6px 12px;border-radius:999px;background:{CHIP};font-size:13px;font-weight:600">{t}</span>'
F["Om"]=("16 Om Direct",f'''{hdr("Om Direct")}
<div style="padding:4px 4px 0"><h1 style="{HF};margin:0;font-size:30px;line-height:1.12;letter-spacing:-0.6px">Gjord för människor, <span style="color:{ACC}">inte för data.</span></h1></div>
{card(prin("lock","Direkt mellan telefoner","Meddelanden, samtal och filer går rakt till mottagaren, krypterade. Ingen läser med.")+prin("folder","Filerna är dina","Ljud, video och filer sparas krypterat i appen per kontakt. Ingen molnkopia. Du rensar själv.")+prin("key","Din nyckel är ditt konto","Ingen e-post, inget lösenord. Identiteten skapas och stannar på din telefon.")+prin("group","Kontakterna stannar hos dig","Telefonboken matchas lokalt. Inget laddas upp."),"",16)}
{card(lab("Vi gör aldrig")+f'<div style="display:flex;gap:8px;flex-wrap:wrap">{chip("Reklam")}{chip("Spårning")}{chip("Datainsamling")}{chip("Försäljning av data")}</div><div style="font-size:12px;line-height:1.5;color:{MUT}">För att koppla upp och ringa används en notistjänst (Google/Apple) och vid behov en relay. De ser aldrig innehållet.</div>',"",10)}
<div style="flex:1"></div>{btn("Förstått",None,"p")}''')

# ---- Inställningar (ny), Språk, Uppdateringar ----
def tog(on,l): return f'<button role="switch" aria-checked="{"true" if on else "false"}" aria-label="{l}" style="width:52px;height:32px;flex:none;border-radius:16px;border:none;background:{DK if on else "#CFC8B8"};display:flex;align-items:center;padding:3px;box-sizing:border-box;justify-content:{"flex-end" if on else "flex-start"}"><span style="width:26px;height:26px;border-radius:50%;background:{CR if on else "#fff"};display:block"></span></button>'
badge=lambda t: f'<span style="padding:3px 10px;border-radius:999px;background:{BEI};font-size:12px;font-weight:600">{t}</span>'
val=lambda t: f'<span style="font-size:13px;font-weight:600;color:{MUT}">{t}</span>'
cbtn=f'<button style="min-height:44px;padding:0 16px;border-radius:12px;border:1px solid {LINE};background:{CHIP};color:{INK};font-size:14px;font-weight:600">Rensa</button>'
F["Installningar"]=("10 Inställningar",f'''<div><div style="{HF};font-size:28px;letter-spacing:-0.5px">Inställningar</div><div style="font-size:14px;color:{MUT};margin-top:2px">Direct är gjord för att stanna hos dig</div></div>
{card(srow("lock","Säkerhet","Lås, IP-skydd och nyckelvarning")+srow("chat","Språk","Följer telefonen",val("Svenska"))+srow("broom","Uppdateringar","Version 0.4.0 · GitHub",badge("Aktuell"))+srow("folder","Lagring och filer","Privat lagring",val("1,8 GB"))+srow("key","Säkerhetskopiera nyckel","Behövs om du byter telefon")+srow("shield","Om Direct och integritet","Så fungerar appen"),"",16)}
{card(lab("Rensa")+f'<div style="display:flex;align-items:center;gap:12px">{sq("broom")}<div style="flex:1"><div style="font-size:16px;font-weight:600">Rensa cache</div><div style="font-size:13px;color:{MUT}">124 MB tillfälliga filer</div></div>{cbtn}</div>'+srow("group","Rensa per kontakt","Välj vilka kontakters filer som tas bort")+f'<div style="display:flex;align-items:center;gap:12px">{sq("trash","#F1DAD6",RED)}<div style="flex:1"><div style="font-size:16px;font-weight:600;color:{RED}">Rensa allt…</div><div style="font-size:13px;color:{MUT}">Tar bort alla ljud, videor och filer</div></div>{ic("next",18,MUT)}</div>',"",14)}
<div style="flex:1"></div>{tabs("Inställningar")}''')
def lopt(t,s,sel): return f'<label style="display:flex;align-items:center;gap:12px;padding:14px;border-radius:16px;border:{"2px solid "+DK if sel else "1px solid "+LINE};background:{CARD if sel else BG}"><div style="flex:1"><div style="font-size:16px;font-weight:600">{t}</div><div style="font-size:13px;color:{MUT}">{s}</div></div><input type="radio" name="sprak" aria-label="{t}" {"checked" if sel else ""} style="width:24px;height:24px;accent-color:{DK}"></label>'
F["Sprak"]=("12 Språk",f'''{hdr("Språk","Välj appens språk")}
{card(lopt("Telefonens språk","Just nu: Svenska",True)+lopt("Svenska","Appen visas på svenska",False)+lopt("English","The app is shown in English",False),"",10)}
{card(f'<div style="display:flex;gap:10px;font-size:13px;line-height:1.5;color:{MUT}">{ic("shield",18,ACC)}<span>Ändringen gäller direkt och sparas bara på din telefon. Om telefonens språk varken är svenska eller engelska används engelska.</span></div>',"padding:12px 16px")}
<div style="flex:1"></div>{btn("Klar",None,"p")}''')
nt=lambda t: f'<div style="display:flex;gap:8px;font-size:13px;line-height:1.45;color:{MUT}"><span style="color:{ACC}">•</span><span>{t}</span></div>'
F["UppdateringNy"]=("13b Ny version finns",f'''{hdr("Uppdateringar","Hämtas från GitHub Releases")}
{card(f'<div style="display:flex;justify-content:space-between;align-items:center">{lab("Ny version")}{badge("Stabil")}</div><div style="{HF};font-size:30px;letter-spacing:-0.5px">Direct 0.5.0</div><div style="font-size:13px;color:{MUT}">Du har 0.4.0 · 18,4 MB · släppt idag</div><div style="height:8px;border-radius:4px;background:{ACC}"></div><div style="display:flex;align-items:center;gap:8px;font-size:13px;font-weight:600;color:{GRN}">{ic("check",16)}Nedladdad och verifierad (SHA-256)</div>'+nt("Snabbare uppkoppling av samtal")+nt("Nytt: Rensa per kontakt")+nt("Felrättningar"),"",10)}
{card(f'<div style="display:flex;align-items:center;gap:12px"><div style="flex:1;font-size:15px;font-weight:600">Sök automatiskt</div>{tog(True,"Sök automatiskt")}</div><div style="display:flex;align-items:center;gap:12px"><div style="flex:1"><div style="font-size:15px;font-weight:600">Källa</div><div style="font-size:12px;color:{MUT}">GitHub · menola8803/direct</div></div>{ic("next",18,MUT)}</div><div style="display:flex;align-items:center;gap:12px"><div style="flex:1;font-size:15px;font-weight:600">Förhandsversioner</div>{tog(False,"Förhandsversioner")}</div>',"",14)}
{card(f'<div style="display:flex;gap:10px;font-size:13px;line-height:1.5;color:{MUT}">{ic("shield",18,ACC)}<span>Uppdateringen installeras ovanpå din app. Chattar, nyckel och filer behålls. Android frågar om du vill installera.</span></div>',"padding:12px 16px")}
<div style="flex:1"></div>{btn("Installera 0.5.0","check","p")}{btn("Sök efter uppdatering",None,"s")}''')

def sw(t,sub,on): return f'<div style="display:flex;align-items:center;gap:12px"><div style="flex:1;min-width:0"><div style="font-size:15px;font-weight:600">{t}</div><div style="font-size:13px;line-height:1.4;color:{MUT}">{sub}</div></div>{tog(on,t)}</div>'
F["Sakerhet"]=("11 Säkerhet",f'''{hdr("Säkerhet","Skydda dig och dina kontakter")}
{card(lab("Appen")+sw("Lås appen","PIN eller fingeravtryck vid start",True)+sw("Dölj innehåll i notiser","Visar bara Nytt meddelande",True)+sw("Blockera skärmdumpar","Gäller även appväxlaren",True),"",14)}
{card(lab("Nätverk")+sw("Dölj min IP-adress","Trafiken går via relay. Något längre fördröjning.",False),"",12)}
{card(lab("Filer")+sw("Spara kopior i Download/Direct","Av: filer lagras krypterat i appen",False),"",12)}
{card(lab("Kontakter")+sw("Varna när en nyckel byts","Rekommenderas",True),"",12)}
<div style="flex:1"></div>{btn("Klar",None,"p")}''')
kline=lambda t,d,c: f'<div style="display:flex;flex-direction:column;gap:4px"><div style="display:flex;justify-content:space-between;font-size:13px"><span style="font-weight:600">{t}</span><span style="color:{MUT}">{d}</span></div><div style="{HF};font-size:18px;letter-spacing:.06em;color:{c}">{c and ""}</div></div>'
def kcode(t,d,code,col): return f'<div style="display:flex;flex-direction:column;gap:4px"><div style="display:flex;justify-content:space-between;font-size:13px"><span style="font-weight:600">{t}</span><span style="color:{MUT}">{d}</span></div><div style="{HF};font-size:19px;letter-spacing:.06em;color:{col}">{code}</div></div>'
F["Nyckelbyte"]=("17 Nyckeln har ändrats",f'''{hdr("Nyckeln har ändrats")}
<div style="display:flex;flex-direction:column;align-items:center;gap:12px;text-align:center;padding:8px 8px 0"><div style="width:72px;height:72px;border-radius:50%;background:{BEI};color:{ACC};display:flex;align-items:center;justify-content:center">{ic("warn",34)}</div>
<h1 style="{HF};margin:0;font-size:28px;line-height:1.15">Annas nyckel har ändrats</h1>
<p style="margin:0;font-size:15px;line-height:1.55;color:{MUT}">Det kan betyda att hon bytt telefon, men också att någon utger sig för henne. Meddelanden är pausade tills du bestämt dig.</p></div>
{card(kcode("Tidigare nyckel","Sedd 12 okt 2026","48213 90571 33846",MUT)+f'<div style="height:1px;background:{LINE}"></div>'+kcode("Ny nyckel","Idag 14:02","77120 45098 62351",ACC),"",12)}
<div style="flex:1"></div>{btn("Verifiera med säkerhetskod","key","p")}{btn("Fortsätt ändå",None,"s")}{btn("Blockera kontakt","warn","dg")}''')
pk=lambda t: f'<button style="width:72px;height:72px;border-radius:50%;border:1px solid {LINE};background:{CARD};color:{INK};{HF};font-size:26px;{SH}">{t}</button>'
dot=lambda on: f'<span style="width:14px;height:14px;border-radius:50%;background:{DK if on else "transparent"};border:2px solid {DK};display:inline-block"></span>'
F["Applas"]=("18 Applås",f'''<div style="flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:10px;text-align:center"><div style="width:64px;height:64px;border-radius:20px;background:{DK};color:{CR};display:flex;align-items:center;justify-content:center">{ic("lock",28)}</div>
<div style="{HF};font-size:28px;margin-top:6px">Direct är låst</div><div style="font-size:14px;color:{MUT}">Ange din PIN-kod</div>
<div style="display:flex;gap:16px;margin:18px 0 8px">{dot(1)}{dot(1)}{dot(0)}{dot(0)}</div>
<div style="display:grid;grid-template-columns:repeat(3,72px);gap:14px;margin-top:10px">{"".join(pk(n) for n in "123456789")}<span></span>{pk("0")}<button aria-label="Radera" style="width:72px;height:72px;border-radius:50%;border:none;background:transparent;color:{MUT}">{ic("back",26)}</button></div>
<button style="min-height:44px;margin-top:10px;border:none;background:transparent;color:{ACC};font-size:15px;font-weight:600">Använd fingeravtryck</button></div>''')

F["Uppdatering"]=("13 Uppdateringar",f'''{hdr("Uppdateringar","Hämtas från GitHub Releases")}
{card(f'<div style="display:flex;flex-direction:column;align-items:center;gap:10px;text-align:center;padding:10px 0"><div style="width:68px;height:68px;border-radius:50%;background:{BEI};color:{ACC};display:flex;align-items:center;justify-content:center">{ic("check",34)}</div><div style="{HF};font-size:28px;letter-spacing:-0.5px">Du har senaste versionen</div><div style="font-size:14px;color:{MUT}">Direct 0.4.0 · senast kontrollerad idag 14:02</div></div>',"",10)}
{card(f'<div style="display:flex;justify-content:space-between;font-size:14px"><span style="color:{MUT}">Installerad version</span><span style="font-weight:600">0.4.0</span></div><div style="display:flex;justify-content:space-between;font-size:14px"><span style="color:{MUT}">Senaste release på GitHub</span><span style="font-weight:600">v0.4.0</span></div><div style="display:flex;justify-content:space-between;font-size:14px"><span style="color:{MUT}">Källa</span><span style="font-weight:600">menola8803/direct</span></div>',"",12)}
{card(f'<div style="display:flex;align-items:center;gap:12px"><div style="flex:1;font-size:15px;font-weight:600">Sök automatiskt</div>{tog(True,"Sök automatiskt")}</div><div style="display:flex;align-items:center;gap:12px"><div style="flex:1;font-size:15px;font-weight:600">Förhandsversioner</div>{tog(False,"Förhandsversioner")}</div>',"",14)}
{card(f'<div style="display:flex;gap:10px;font-size:13px;line-height:1.5;color:{MUT}">{ic("shield",18,ACC)}<span>Sökningen visar din IP-adress för GitHub. Stäng av automatisk sökning om du inte vill det.</span></div>',"padding:12px 16px")}
<div style="flex:1"></div>{btn("Sök efter uppdatering","search","p")}''')
for k,(t,b) in F.items(): open(k+".dc.html","w").write(page(t[t.index(" ")+1:] if t[0].isdigit() else t,b))
rows=[["Main","Kontakter","Chatt","Dela","Rost","Videomeddelande"],["Sakerhetskod","Videokonferens","Samtal","Nyckelbyte","Applas"],["Installningar","Sakerhet","Sprak","Uppdatering","UppdateringNy","Lagring","Rensa","Om"]]
c=json.load(open("canvas.json")); c["boards"]={}; c["order"]=[]
for r,names in enumerate(rows):
    for i,n in enumerate(names):
        f=n+".dc.html"; c["boards"][f]={"h":844,"title":F[n][0],"w":390,"x":i*470,"y":r*1200}; c["order"].append(f)
c["notes"]={"t1":{"kind":"title1","maxW":2740,"text":"Direct: skärmflöde","x":0,"y":-260},"t2":{"kind":"title1","maxW":2270,"text":"Samtal, verifiering och lås","x":0,"y":940},"t3":{"kind":"title1","maxW":3680,"text":"Inställningar, uppdatering, filer och integritet","x":0,"y":2140}}
c["title"]="Direct – skärmdesign"
json.dump(c,open("canvas.json","w"),ensure_ascii=False,indent=2)
