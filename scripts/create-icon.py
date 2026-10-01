from pathlib import Path
from PIL import Image, ImageDraw
root=Path(__file__).resolve().parents[1]/'web'/'public'/'icons'
ink='#242b27'
svg='''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><rect width="512" height="512" rx="100" fill="#f6f1e4"/><rect x="82" y="87" width="356" height="346" rx="60" fill="#242b27" transform="rotate(-7 256 256)"/><rect x="68" y="72" width="356" height="346" rx="60" fill="#f2c64f" stroke="#242b27" stroke-width="12" transform="rotate(-7 256 256)"/><path d="M205 341 L197 393 M286 341 L308 393" fill="none" stroke="#242b27" stroke-width="16" stroke-linecap="round"/><path d="M164 390 Q189 375 207 388 L222 410 L159 416 Z M292 388 Q311 376 327 388 L352 410 L291 415 Z" fill="#266d62" stroke="#242b27" stroke-width="10"/><path d="M256 346 C224 310 150 246 150 201 C150 141 194 111 256 111 C318 111 362 141 362 201 C362 246 288 310 256 346Z" fill="#ef684e" stroke="#242b27" stroke-width="12" stroke-linejoin="round"/><ellipse cx="221" cy="193" rx="26" ry="33" fill="#f6f1e4" stroke="#242b27" stroke-width="8"/><ellipse cx="285" cy="184" rx="26" ry="33" fill="#f6f1e4" stroke="#242b27" stroke-width="8"/><circle cx="230" cy="198" r="10" fill="#242b27"/><circle cx="294" cy="189" r="10" fill="#242b27"/><path d="M228 245 Q256 272 290 235" fill="none" stroke="#242b27" stroke-width="10" stroke-linecap="round"/><path d="M103 153 L108 132 L117 151 L135 158 L115 166 L109 185 L102 166 L83 160 Z M398 281 L404 261 L411 282 L428 288 L410 296 L405 315 L397 296 L380 290 Z" fill="#f6f1e4" stroke="#242b27" stroke-width="6"/></svg>'''
root.mkdir(parents=True,exist_ok=True)
(root/'spotland.svg').write_text(svg,encoding='utf-8')
# Raster versions share the SVG geometry; oversample for crisp small icons.
im=Image.new('RGB',(2048,2048),'#f6f1e4')
class ScaledDraw:
    def __init__(self, image): self.draw=ImageDraw.Draw(image)
    def coords(self, xy): return [(x*4,y*4) for x,y in xy] if isinstance(xy[0],(tuple,list)) else tuple(v*4 for v in xy)
    def line(self, xy, **kw): kw['width']=kw.get('width',1)*4; self.draw.line(self.coords(xy),**kw)
    def polygon(self, xy, **kw): kw['width']=kw.get('width',1)*4; self.draw.polygon(self.coords(xy),**kw)
    def ellipse(self, xy, **kw): kw['width']=kw.get('width',1)*4; self.draw.ellipse(self.coords(xy),**kw)
    def rounded_rectangle(self, xy, radius, **kw): kw['width']=kw.get('width',1)*4; self.draw.rounded_rectangle(self.coords(xy),radius*4,**kw)
d=ScaledDraw(im)
d.rounded_rectangle((82,87,438,433),60,fill=ink)
d.rounded_rectangle((68,72,424,418),60,fill='#f2c64f',outline=ink,width=12)
d.line((205,341,197,393),fill=ink,width=16); d.line((286,341,308,393),fill=ink,width=16)
d.polygon([(164,390),(189,380),(207,388),(222,410),(159,416)],fill='#266d62',outline=ink,width=10)
d.polygon([(292,388),(311,380),(327,388),(352,410),(291,415)],fill='#266d62',outline=ink,width=10)
def cubic(a,b,c,e):
    return [tuple((1-t)**3*a[j]+3*(1-t)**2*t*b[j]+3*(1-t)*t*t*c[j]+t**3*e[j] for j in (0,1)) for t in [i/60 for i in range(61)]]
points=[(256,346)]+cubic((256,346),(224,310),(150,246),(150,201))+cubic((150,201),(150,141),(194,111),(256,111))+cubic((256,111),(318,111),(362,141),(362,201))+cubic((362,201),(362,246),(288,310),(256,346))
d.polygon(points,fill='#ef684e'); d.line(points,fill=ink,width=12,joint='curve')
for cx,cy in [(221,193),(285,184)]:
    d.ellipse((cx-26,cy-33,cx+26,cy+33),fill='#f6f1e4',outline=ink,width=8);d.ellipse((cx-1,cy-5,cx+19,cy+15),fill=ink)
d.line(cubic((228,245),(245,265),(268,265),(290,235)),fill=ink,width=10)
for pts in [[(103,153),(108,132),(117,151),(135,158),(115,166),(109,185),(102,166),(83,160)],[(398,281),(404,261),(411,282),(428,288),(410,296),(405,315),(397,296),(380,290)]]:d.polygon(pts,fill='#f6f1e4',outline=ink,width=6)
for size in (192,512):im.resize((size,size),Image.Resampling.LANCZOS).save(root/f'spotland-{size}.png',optimize=True)

