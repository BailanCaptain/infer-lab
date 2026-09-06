"""Build the compute-city source and a material-batched glTF. No external assets.
Blender --background --python scripts/blender/build_city.py
"""
import bpy
import bmesh
import json
import math
import random
import numpy as np
from mathutils import Vector
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
CONFIG = json.loads((ROOT/'src/app/intro/city.json').read_text(encoding='utf-8'))
random.seed(CONFIG['seed'])
bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)
PARTS = {}
MATS = {}
SOURCE = ROOT/'assets/city'
PUBLIC = ROOT/'public/models'
SOURCE.mkdir(parents=True,exist_ok=True)
PUBLIC.mkdir(parents=True,exist_ok=True)

def linear(c):
    return c/12.92 if c <= .04045 else ((c+.055)/1.055)**2.4

def material(name, color, rough=.7, metal=.0, emission=0):
    rgb = tuple(linear(int(color[i:i+2],16)/255) for i in (1,3,5))
    m = bpy.data.materials.new(name)
    m.diffuse_color = (*rgb,1)
    m.use_nodes = True
    p = m.node_tree.nodes.get('Principled BSDF')
    p.inputs['Base Color'].default_value = (*rgb,1)
    p.inputs['Roughness'].default_value = rough
    p.inputs['Metallic'].default_value = metal
    if emission:
        p.inputs['Emission Color'].default_value = (*rgb,1)
        p.inputs['Emission Strength'].default_value = emission
    MATS[name] = m
    return m

for name,color in CONFIG['palette'].items():
    material(name,color,.48 if name in ['metal','glass'] else .78,.2 if name in ['metal','glass'] else 0,
             2 if name == 'light' else 1.5 if name == 'signal' else 0)
material('asphalt','#6c7870')
material('paving','#a4a795')
material('hair','#222720')
material('shoe','#d5d4bf')
material('distant','#94a49a')
material('mountain','#a5b3a8')
material('fan','#506660',.45,.3)
material('glass canopy','#afcbc0',.3,.2)

# Two packed atlas textures make thousands of windows economical to render.
W,H = 256,1024
pixels = np.zeros((H,W,4),dtype=np.float32)
pixels[:,:,:3] = [.14,.19,.17]
pixels[:,:,3] = 1
emit = np.zeros_like(pixels)
emit[:,:,3] = 1
rng = random.Random(116)
for row in range(64):
    y = row*16
    pixels[y:y+2,:,:3] = [.32,.37,.31]
    for col in range(8):
        x = col*32+7
        lit = rng.random() > .44
        pixels[y+5:y+11,x:x+7,:3] = [.88,.8,.54] if lit else [.22,.3,.26]
        if lit: emit[y+5:y+11,x:x+7,:3] = [1,.77,.33]
        pixels[y+5:y+11,x+10:x+22,:3] = [.08,.13,.12]
        pixels[y+13:y+14,x:x+23,:3] = [.34,.38,.31]
for name,array in [('rack-albedo',pixels),('rack-emission',emit)]:
    image = bpy.data.images.new(name,width=W,height=H,alpha=True)
    image.pixels.foreach_set(array.ravel())
    image.filepath_raw = str(SOURCE/(name+'.png'))
    image.file_format = 'PNG'
    image.save()
    image.pack()
rack = material('rack','#ffffff',.63,.12)
p = rack.node_tree.nodes.get('Principled BSDF')
for name,target in [('rack-albedo','Base Color'),('rack-emission','Emission Color')]:
    t = rack.node_tree.nodes.new('ShaderNodeTexImage')
    t.image = bpy.data.images[name]
    t.interpolation = 'Closest'
    rack.node_tree.links.new(t.outputs['Color'],p.inputs[target])
p.inputs['Emission Strength'].default_value = .85

def mesh(name,vertices,faces,mat,uvs=None):
    verts,polys,uv = PARTS.setdefault((name,mat),([],[],[]))
    offset = len(verts)
    verts.extend(tuple(v) for v in vertices)
    polys.extend(tuple(offset+i for i in f) for f in faces)
    uv.extend(uvs if uvs is not None else [(0,0)]*len(vertices))

def box(name,center,size,mat,angle=0):
    x,y,z = center
    a,b,c = [v/2 for v in size]
    co,si = math.cos(angle),math.sin(angle)
    points=[(x+u*co-v*si,y+u*si+v*co,z+w) for u,v,w in
            [(-a,-b,-c),(a,-b,-c),(a,b,-c),(-a,b,-c),(-a,-b,c),(a,-b,c),(a,b,c),(-a,b,c)]]
    mesh(name,points,[(0,3,2,1),(4,5,6,7),(0,1,5,4),(1,2,6,5),(2,3,7,6),(3,0,4,7)],mat)

def tube(name,points,radius,mat,sides=6,taper=1):
    verts=[]
    for i,p in enumerate(points):
        d=(Vector(points[min(i+1,len(points)-1)])-Vector(points[max(i-1,0)])).normalized()
        a=d.cross(Vector((0,0,1)))
        if a.length < .01: a=Vector((1,0,0))
        a.normalize()
        b=d.cross(a).normalized()
        r=radius*(1-(1-taper)*i/max(1,len(points)-1))
        verts.extend(tuple(Vector(p)+r*(a*math.cos(j*math.tau/sides)+b*math.sin(j*math.tau/sides))) for j in range(sides))
    faces=[tuple(range(sides-1,-1,-1))]
    for i in range(len(points)-1):
        for j in range(sides):
            a=i*sides+j;b=i*sides+(j+1)%sides
            faces.append((a,b,b+sides,a+sides))
    faces.append(tuple((len(points)-1)*sides+i for i in range(sides)))
    mesh(name,verts,faces,mat)

def ellipsoid(name,c,s,mat,rings=7,sides=12):
    verts=[]
    for j in range(rings+1):
        v=j/rings*math.pi
        for i in range(sides):
            u=i/sides*math.tau
            verts.append((c[0]+s[0]*math.sin(v)*math.cos(u),c[1]+s[1]*math.sin(v)*math.sin(u),c[2]+s[2]*math.cos(v)))
    faces=[]
    for j in range(rings):
        for i in range(sides):
            a=j*sides+i;b=j*sides+(i+1)%sides
            faces.append((a,a+sides,b+sides,b))
    mesh(name,verts,faces,mat)

def ring(name,x,y,z,r,mat,width=.04):
    points=[(x+r*math.cos(i/20*math.tau),y+r*math.sin(i/20*math.tau),z) for i in range(21)]
    tube(name,points,width,mat,5)

def fan(name,x,y,z,r=.5):
    box(name,(x,y,z-.13),(r*2.5,r*2.5,.25),'metal')
    tube(name,[(x,y,z-.05),(x,y,z+.08)],r,'fan',20)
    ring(name,x,y,z+.1,r,'edge',.045)
    ring(name,x,y,z+.12,r*.72,'metal',.02)
    for j in range(7):
        a=j/7*math.tau
        vs=[]
        for rr,da in [(r*.15,0),(r*.84,.15),(r*.84,.45),(r*.3,.68)]:
            vs.append((x+rr*math.cos(a+da),y+rr*math.sin(a+da),z+.11))
        mesh(name,vs,[(0,1,2,3)],'edge')
    tube(name,[(x,y,z),(x,y,z+.18)],r*.14,'metal',10)

def facade(name,x,y,z,w,d,h):
    # UV height is proportional to the number of server shelves.
    uv=[(0,0),(1,0),(1,h/22),(0,h/22)]
    mesh(name,[(x-w/2,y-d/2-.015,z),(x+w/2,y-d/2-.015,z),(x+w/2,y-d/2-.015,z+h),(x-w/2,y-d/2-.015,z+h)],[(0,1,2,3)],'rack',uv)
    mesh(name,[(x+w/2+.015,y-d/2,z),(x+w/2+.015,y+d/2,z),(x+w/2+.015,y+d/2,z+h),(x+w/2+.015,y-d/2,z+h)],[(0,1,2,3)],'rack',uv)
    mesh(name,[(x+w/2,y+d/2+.015,z),(x-w/2,y+d/2+.015,z),(x-w/2,y+d/2+.015,z+h),(x+w/2,y+d/2+.015,z+h)],[(0,1,2,3)],'rack',uv)
    mesh(name,[(x-w/2-.015,y+d/2,z),(x-w/2-.015,y-d/2,z),(x-w/2-.015,y-d/2,z+h),(x-w/2-.015,y+d/2,z+h)],[(0,1,2,3)],'rack',uv)

def tower(name,x,y,w,d,h,hero=False,engine=False):
    box(name,(x,y,.3),(w+.7,d+.7,.6),'concrete')
    box(name,(x,y,h/2+.6),(w,d,h),'dark')
    facade(name,x,y,1.0,w+.04,d+.04,h-1)
    for dx in [-w/2,w/2]:
        for dy in [-d/2,d/2]:
            box(name,(x+dx,y+dy,h/2+.7),(.28,.28,h+.1),'edge')
    # Recessed racks separated by full-height machined structural fins.
    for i in range(1,max(2,int(w/.72))):
        dx=-w/2+i*w/max(2,int(w/.72))
        for dy in [-d/2-.05,d/2+.05]:
            box(name,(x+dx,y+dy,h/2+.6),(.11,.21,h-.15),'metal')
    for i in range(1,max(2,int(d/.75))):
        dy=-d/2+i*d/max(2,int(d/.75))
        for dx in [-w/2-.05,w/2+.05]:
            box(name,(x+dx,y+dy,h/2+.6),(.2,.1,h-.15),'metal')
    for zz in [.85,h+.65]:
        box(name,(x,y,zz),(w+.32,d+.32,.22),'edge')
    for dx in [-w*.46,w*.46]:
        box(name,(x+dx,y-d*.51,.7),(.045,.04,h*0+.8),'light')
    box(name,(x,y,h+.78),(w-.2,d-.2,.12),'metal')
    if hero:
        box(name,(x,y-d/2-.2,h*.79),(w*.79,.28,h*.22),'dark')
        for dx in [-w*.42,w*.42]:
            box(name,(x+dx,y-d/2-.35,h*.76),(.16,.32,h*.43),'edge')
        box(name,(x,y,h+1.5),(w*.58,d*.6,1.4),'dark')
        facade(name,x,y,h+.85,w*.58+.04,d*.6+.04,1.3)
    if engine:
        for dx in [-w*.32,0,w*.32]:
            for dy in [-d*.26,d*.26]:
                box(name,(x+dx,y+dy,h+1.25),(w*.22,d*.28,.85),'dark')
                box(name,(x+dx,y+dy,h+1.7),(w*.16,d*.22,.08),'signal')
        for dx in [-w*.47,w*.47]:
            for dy in [-d*.47,d*.47]:
                box(name,(x+dx,y+dy,h+1.5),(.07,.07,1.5),'edge')
        for dy in [-d*.47,d*.47]:
            tube(name,[(x-w*.47,y+dy,h+2.25),(x+w*.47,y+dy,h+2.25)],.045,'signal',4)
        for dx in [-w*.47,w*.47]:
            tube(name,[(x+dx,y-d*.47,h+2.25),(x+dx,y+d*.47,h+2.25)],.045,'signal',4)
    else:
        r=min(w,d)*.17
        for dx in [-w*.27,w*.27]:
            for dy in [-d*.27,d*.27]: fan(name,x+dx,y+dy,h+.93,r)
    # Rooftop exhausts, communications masts and utility housings.
    box(name,(x+w*.3,y+d*.15,h+1.1),(.55,.7,.5),'concrete')
    tube(name,[(x+w*.36,y+d*.36,h+.8),(x+w*.36,y+d*.36,h+2.1)],.025,'metal',5)

def label(body,x,y,z,size,mat='edge'):
    curve=bpy.data.curves.new(body,'FONT');curve.body=body;curve.size=size;curve.align_x='CENTER'
    curve.extrude=.004;curve.resolution_u=3;curve.materials.append(MATS[mat])
    obj=bpy.data.objects.new('Inscription '+body,curve);bpy.context.collection.objects.link(obj)
    obj.location=(x,y,z);obj.rotation_euler=(math.pi/2,0,0)
    bpy.context.view_layer.objects.active=obj;obj.select_set(True)
    bpy.ops.object.convert(target='MESH');obj.select_set(False)

# City blocks, broad boulevard grid, harbor and distant skyline.
box('City foundation',(4,13,-.6),(76,66,1),'paving')
for x in [-25,-16,-7,4,15,26,37]:
    box('Boulevards',(x,12,.015),(2,65,.06),'asphalt')
    for dx in [-.82,.82]: box('Boulevard light guides',(x+dx,12,.06),(.035,65,.035),'light')
    for y in range(-19,44,3): box('Road markings',(x,y,.065),(.04,1,.01),'edge')
for y in [-19,-9,1,21,31,41]:
    box('Boulevards',(5,y,.02),(72,2,.06),'asphalt')
    for dy in [-.8,.8]: box('Boulevard light guides',(5,y+dy,.07),(72,.03,.03),'light')

for landmark in CONFIG['landmarks']:
    x,y,z=landmark['position'];w,d,h=landmark['size']
    tower(landmark['id'],x,y,w,d,h,landmark['id'] in ['gpu','npu'],landmark['id']=='engine')
    if landmark['id'] in ['gpu','npu']:
        label(landmark['brand'],x,y-d/2-.36,h*.765,w*.115)
        label('AI COMPUTING',x,y-d/2-.36,h*.71,w*.031)
        # Circuit chip symbol above the wordmark, kept geometric and editable.
        box(landmark['id'],(x,y-d/2-.36,h*.845),(1.2,.04,.9),'edge')
        box(landmark['id'],(x,y-d/2-.40,h*.845),(.82,.03,.55),'dark')
        for i in range(5):
            for dx in [-.73,.73]: box(landmark['id'],(x+dx,y-d/2-.37,h*.81+i*.12),(.22,.04,.035),'edge')
    else: label(landmark['brand'],x,y-d/2-.16,h*.72,min(.34,w*.06))

for ix,x in enumerate([-30,-20.5,-11.5,-1.5,9.5,20.5,31.5]):
    for iy,y in enumerate([-14,-4,6,16,26,36]):
        w=random.uniform(3.1,5.2);d=random.uniform(3.2,5.6)
        if any(abs(x-l['position'][0])<(w+l['size'][0])/2+1 and abs(y-l['position'][1])<(d+l['size'][1])/2+1 for l in CONFIG['landmarks']): continue
        h=random.uniform(5,15)
        if y>25: h*=.72
        tower(f'Block {ix}-{iy}',x,y,w,d,h)
        for j in range(3):
            bx=x+random.uniform(-2,2);by=y+random.uniform(-2,2)
            box('Utility boxes',(bx,by,.45),(.4,.4,.8),'metal')

def viaduct(name,points,width):
    pts=[Vector(p) for p in points]
    # Straight segments with close stations make editable parallel road ribbons.
    for j in range(len(pts)-1):
        a,b=pts[j],pts[j+1];length=(b-a).length;angle=math.atan2(b.y-a.y,b.x-a.x)
        normal=Vector((-math.sin(angle),math.cos(angle),0))
        midpoint=(a+b)/2
        box(name,midpoint,(length+.07,width,.24),'road',angle)
        box(name,midpoint-Vector((0,0,.24)),(length+.07,width*.74,.24),'concrete',angle)
        for s in [-1,1]:
            tube(name,[a+normal*s*width*.48+Vector((0,0,.18)),b+normal*s*width*.48+Vector((0,0,.18))],.045,'signal',5)
            tube(name,[a+normal*s*width*.28+Vector((0,0,.14)),b+normal*s*width*.28+Vector((0,0,.14))],.019,'light',4)
        for k in range(max(1,int(length/4))):
            p=a.lerp(b,(k+.5)/max(1,int(length/4)))
            box(name,(p.x,p.y,p.z/2-.2),(.35,.5,p.z-.4),'concrete',angle)
        for k in range(max(1,int(length/2))):
            p=a.lerp(b,(k+.5)/max(1,int(length/2)))
            box('Data shuttles',p+normal*.24+Vector((0,0,.28)),(.5,.24,.17),'edge',angle)

viaduct('East west fabric',[(-29,-8,4.7),(-14,-7,4.7),(-2,-5,4.7),(11,1,4.7),(28,18,4.7),(37,23,4.7)],2.1)
viaduct('North south fabric',[(-26,26,6.8),(-16,17,6.8),(-7,8,6.8),(4,-4,6.8),(17,-16,6.8),(28,-24,6.8)],1.8)

box('Harbor',(0,69,-.13),(240,54,.18),'water')
box('Far shoreline',(0,110,-.25),(230,44,.5),'concrete')
for i in range(150):
    x=random.uniform(-98,100);y=random.uniform(92,124);h=random.uniform(2,13)
    if i in [9,42,90]: h=27
    w=random.uniform(.9,2.7);d=random.uniform(1,3)
    box('Distant skyline',(x,y,h/2),(w,d,h),'distant')
    if i%3==0:
        box('Distant mullions',(x,y-d/2-.02,h/2),(.06,.04,h),'edge')
        tube('Distant spires',[(x,y,h),(x,y,h+random.uniform(1,4))],.05,'distant',4)
for i in range(24):
    x=random.uniform(-110,110);y=random.uniform(51,85)
    box('Harbor shimmer',(x,y,0),(random.uniform(1,6),.035,.02),'edge')
for i in range(4):
    x=-28+i*21;y=63+random.uniform(-4,5)
    box('Harbor vessel',(x,y,.22),(2.8,.7,.42),'edge')
    box('Harbor vessel',(x-.5,y,.62),(.9,.55,.4),'metal')

vertices=[]
for i in range(81):
    x=-170+i*4.3;h=8+7*math.sin(i*.18)**2+random.uniform(0,3)
    vertices.extend([(x,145,-1),(x,145,h)])
mesh('Mountain horizon',vertices,[(i*2,i*2+2,i*2+3,i*2+1) for i in range(80)],'mountain')

# Foreground overlook: human-scale cues anchor the otherwise huge server city.
deck_z=5.7
box('Observation terrace',(-12,-29,deck_z-.4),(22,8,.8),'concrete')
for x in range(-23,0,2): box('Terrace seams',(x,-29,deck_z+.004),(.018,8,.012),'metal')
for y in range(-33,-24,2): box('Terrace seams',(-12,y,deck_z+.006),(22,.018,.012),'metal')
box('Terrace parapet',(-12,-25,deck_z+.28),(22,.45,.56),'concrete')
box('Terrace lighting',(-12,-25.24,deck_z+.58),(22,.04,.035),'light')
for x in range(-23,0,2): tube('Terrace railing',[(x,-25,deck_z+.55),(x,-25,deck_z+1.8)],.045,'metal',8)
tube('Terrace handrail',[(-23,-25,deck_z+1.8),(-1,-25,deck_z+1.8)],.065,'edge',8)
tube('Terrace lower rail',[(-23,-25,deck_z+.95),(-1,-25,deck_z+.95)],.026,'metal',6)
box('Terrace sign',(-20,-25.4,deck_z+1.05),(3.4,.3,2.1),'concrete')
label('LEARN',-20,-25.57,deck_z+1.5,.25,'dark')
label('BUILD',-20,-25.57,deck_z+1,.25,'dark')
label('ACCELERATE',-20,-25.57,deck_z+.5,.21,'dark')

def person(x,y,z):
    name='Observer with backpack'
    for dx in [-.24,.24]:
        knee=(x+dx,y+.05,z+.91)
        tube(name,[(x+dx,y,z+1.77),knee,(x+dx*1.15,y-.08,z+.19)],.18,'clothes',10,.76)
        ellipsoid(name,(x+dx*1.15,y+.05,z+.15),(.22,.4,.15),'shoe')
        ellipsoid(name,(x+dx*1.15,y+.07,z+.21),(.2,.34,.15),'clothes')
    ellipsoid(name,(x,y,z+2.19),(.54,.33,.72),'clothes',10,16)
    tube(name,[(x,y,z+2.65),(x,y,z+2.96)],.15,'skin',10)
    ellipsoid(name,(x,y+.015,z+3.2),(.29,.26,.38),'skin',10,16)
    ellipsoid(name,(x,y-.025,z+3.37),(.31,.285,.26),'hair',9,16)
    ellipsoid(name,(x,y-.21,z+3.2),(.28,.1,.24),'hair',7,14)
    for dx in [-.5,.5]:
        tube(name,[(x+dx,y,z+2.56),(x+dx*1.15,y-.04,z+2.05),(x+dx*.99,y+.05,z+1.71)],.16,'clothes',10,.72)
        ellipsoid(name,(x+dx,y+.04,z+1.68),(.12,.12,.19),'skin')
        tube(name,[(x+dx*.7,y-.23,z+2.68),(x+dx*.76,y-.36,z+2.2),(x+dx*.63,y-.29,z+1.75)],.055,'dark',6)
    ellipsoid(name,(x,y-.4,z+2.18),(.4,.24,.6),'dark',10,14)
    ellipsoid(name,(x,y-.58,z+2.02),(.3,.1,.3),'clothes',8,12)
    tube(name,[(x-.23,y-.61,z+2.22),(x+.23,y-.61,z+2.22)],.018,'metal',5)
    # Hood and waistband keep the silhouette recognizably clothed.
    ellipsoid(name,(x,y-.18,z+2.72),(.32,.22,.17),'dark')
    tube(name,[(x-.36,y-.24,z+1.66),(x+.36,y-.24,z+1.66)],.05,'shoe',5)
person(-10,-27,deck_z)
for i in range(26):
    x=random.uniform(-25,-20);y=random.uniform(-33,-27);z=deck_z+random.uniform(.5,3)
    ellipsoid('Foreground garden',(x,y,z),(random.uniform(.4,.9),.7,.6),'tree',5,8)
for i in range(35):
    x=random.uniform(-30,35);y=random.uniform(-18,42)
    if any(abs(x-l['position'][0])<l['size'][0]/2+.4 and abs(y-l['position'][1])<l['size'][1]/2+.4 for l in CONFIG['landmarks']): continue
    tube('Street trees',[(x,y,.05),(x,y,1.1)],.045,'dark',5)
    ellipsoid('Street trees',(x,y,1.2),(.5,.5,.65),'tree',5,8)

foreground = {'Observation terrace','Terrace seams','Terrace parapet','Terrace lighting','Terrace railing','Terrace handrail','Terrace lower rail','Terrace sign','Foreground garden','Observer with backpack'}
for (name,mat),(verts,faces,uvs) in PARTS.items():
    if name == 'Observer with backpack':
        verts = [(-10+(x+10)*1.55,-27+(y+27)*1.55,deck_z+(z-deck_z)*1.55) for x,y,z in verts]
    if name in foreground:
        verts = [(x+21,y-8,z+7) for x,y,z in verts]
    data=bpy.data.meshes.new(name)
    data.from_pydata(verts,[],faces);data.materials.append(MATS[mat]);data.update()
    if mat=='rack':
        layer=data.uv_layers.new(name='Rack UV')
        for poly in data.polygons:
            for loop in poly.loop_indices: layer.data[loop].uv=uvs[data.loops[loop].vertex_index]
    if name=='Observer with backpack':
        for poly in data.polygons: poly.use_smooth=True
    obj=bpy.data.objects.new(name+' | '+mat,data);bpy.context.collection.objects.link(obj)

for obj in list(bpy.context.scene.objects):
    if obj.name.startswith('Inscription ') and any(word in obj.name for word in ['LEARN','BUILD','ACCELERATE']):
        obj.location += Vector((21,-8,7))

scene=bpy.context.scene
scene.world.use_nodes=True
scene.world.node_tree.nodes['Background'].inputs[0].default_value=(.74,.79,.71,1)
scene.world.node_tree.nodes['Background'].inputs[1].default_value=.7
bpy.ops.object.light_add(type='SUN',location=(-25,-15,50))
bpy.context.object.rotation_euler=(.5,-.45,-.45)
bpy.context.object.data.energy=2.7;bpy.context.object.data.angle=.15
target=Vector((CONFIG['camera']['target'][0],-CONFIG['camera']['target'][2],CONFIG['camera']['target'][1]))
offset=CONFIG['camera']['offset']
bpy.ops.object.camera_add(location=target+Vector((offset[0],-offset[2],offset[1])))
scene.camera=bpy.context.object
scene.camera.rotation_euler=(target-scene.camera.location).to_track_quat('-Z','Y').to_euler()
scene.camera.data.lens=44
scene.render.engine='CYCLES';scene.cycles.samples=32
scene.render.resolution_x=1600;scene.render.resolution_y=900;scene.render.resolution_percentage=100
scene.view_settings.view_transform='AgX'
for area in bpy.context.screen.areas:
    if area.type=='VIEW_3D': area.spaces.active.region_3d.view_perspective='CAMERA'
bpy.context.preferences.filepaths.save_version=0
bpy.ops.wm.save_as_mainfile(filepath=str(SOURCE/'compute-city.blend'),compress=True)

# Source stays editable; only the web copy is batched. Never decimate material-separated shells.
groups={}
for obj in list(scene.objects):
    if obj.type=='MESH': groups.setdefault(obj.data.materials[0].name,[]).append(obj)
for mat,objects in groups.items():
    bpy.ops.object.select_all(action='DESELECT')
    for obj in objects: obj.select_set(True)
    bpy.context.view_layer.objects.active=objects[0]
    if len(objects)>1: bpy.ops.object.join()
    bpy.context.object.name='City | '+mat
bpy.ops.export_scene.gltf(filepath=str(PUBLIC/CONFIG['model']),export_format='GLB',export_cameras=False,
    export_lights=False,export_yup=True,export_draco_mesh_compression_enable=True,export_draco_mesh_compression_level=6)
for obj in scene.objects:
    if obj.type=='MESH': obj.data.calc_loop_triangles()
stats={'webMeshes':len(groups),'triangles':sum(len(o.data.loop_triangles) for o in scene.objects if o.type=='MESH'),
       'glbBytes':(PUBLIC/CONFIG['model']).stat().st_size,'seed':CONFIG['seed']}
(SOURCE/'build-stats.json').write_text(json.dumps(stats,indent=2)+'\n',encoding='utf-8')
print('CITY_BUILD',json.dumps(stats))
