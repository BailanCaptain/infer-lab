"""Deterministic, editable mountain world. Run with Blender --background --python this_file.

The shared world.json owns chapter positions, wording and material colors.
Geometry is grouped by material to keep the exported scene economical to draw.
No external models, images, or add-ons are needed.
"""
import bpy
import json
import math
import random
from pathlib import Path
from mathutils import Vector, noise

ROOT = Path(__file__).resolve().parents[2]
CONFIG = json.loads((ROOT / 'src/app/intro/world.json').read_text(encoding='utf-8'))
random.seed(CONFIG['seed'])
bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)
PARTS = {}
MATERIALS = {}


def linear(v):
    return v / 12.92 if v < .04045 else ((v + .055) / 1.055) ** 2.4


def material(name, color, variation=1):
    rgb = tuple(linear(int(color[i:i+2], 16) / 255) * variation for i in (1, 3, 5))
    m = bpy.data.materials.new(name)
    m.diffuse_color = (*rgb, 1)
    m.use_nodes = True
    bsdf = m.node_tree.nodes.get('Principled BSDF')
    bsdf.inputs['Base Color'].default_value = (*rgb, 1)
    bsdf.inputs['Roughness'].default_value = .88
    MATERIALS[name] = m
    return name


for key, value in CONFIG['palette'].items():
    material(key, value)
for i in range(9):
    material(f'rock_{i}', CONFIG['palette']['stone'], .78 + i * .055)
for i in range(5):
    material(f'leaf_{i}', CONFIG['palette']['pine'], .7 + i * .22)


def mesh(name, vertices, faces, mat):
    key = (name, mat)
    v, f = PARTS.setdefault(key, ([], []))
    offset = len(v)
    used = sorted({n for face in faces for n in face})
    remap = {n: offset+i for i,n in enumerate(used)}
    v.extend(vertices[n] for n in used)
    f.extend(tuple(remap[n] for n in face) for face in faces)


def box(name, center, size, mat, angle=0):
    x, y, z = center
    a, b, c = (v / 2 for v in size)
    co, si = math.cos(angle), math.sin(angle)
    verts = [(x + u*co-v*si, y+u*si+v*co, z+w) for u, v, w in
             [(-a,-b,-c), (a,-b,-c), (a,b,-c), (-a,b,-c),
              (-a,-b,c), (a,-b,c), (a,b,c), (-a,b,c)]]
    mesh(name, verts, [(0,3,2,1),(4,5,6,7),(0,1,5,4),(1,2,6,5),(2,3,7,6),(3,0,4,7)], mat)


def tube(name, points, radius, mat, sides=6, taper=1):
    vertices = []
    for i, p in enumerate(points):
        p = Vector(p)
        direction = Vector(points[min(i+1, len(points)-1)]) - Vector(points[max(0, i-1)])
        direction.normalize()
        a = direction.cross(Vector((0,0,1)))
        if a.length < .01:
            a = Vector((1,0,0))
        a.normalize()
        b = direction.cross(a).normalized()
        r = radius * (1 - (1-taper)*i / max(1, len(points)-1))
        vertices.extend(tuple(p+r*(a*math.cos(t*math.tau/sides)+b*math.sin(t*math.tau/sides))) for t in range(sides))
    faces = [tuple(range(sides-1,-1,-1))]
    for i in range(len(points)-1):
        for j in range(sides):
            a = i*sides+j
            b = i*sides+(j+1)%sides
            faces.append((a,b,b+sides,a+sides))
    faces.append(tuple((len(points)-1)*sides+j for j in range(sides)))
    mesh(name, vertices, faces, mat)


def rock(name, center, scale, seed, detail=20, rings=14):
    rng = random.Random(seed)
    x, y, z = center
    rx, ry, h = scale
    phase = rng.random()*20
    ribs = [rng.uniform(.76,1.2) for _ in range(detail)]
    vertices = []
    for j in range(rings+1):
        t = j/rings
        # Pointed suspended root, broad shoulders and a weathered crown.
        profile = max(.025, math.sin(t*math.pi*.88)**.63)
        for i in range(detail):
            angle = i/detail*math.tau
            n = noise.noise_vector(Vector((math.cos(angle)*3+phase, math.sin(angle)*3, t*7)))[0]
            fine = noise.noise_vector(Vector((math.cos(angle)*13+phase, math.sin(angle)*13, t*32)))[0]
            r = profile * ribs[i] * (1+n*.29+fine*.06)
            zz = z-h + t*h + (rng.random()-.5)*h*.024
            vertices.append((x+math.cos(angle)*rx*r+.13*rx*math.sin(t*4+phase), y+math.sin(angle)*ry*r, zz))
    vertices.append((x,y,z+.05))
    for j in range(rings):
        for i in range(detail):
            a = j*detail+i
            b = j*detail+(i+1)%detail
            middle = Vector(vertices[a]).lerp(Vector(vertices[b+detail]),.5)
            weather = noise.noise_vector(middle*.75)[0]
            shade = f'rock_{max(0,min(8,round(4+weather*5)))}'
            mesh(name, vertices, [(a,b,b+detail),(a,b+detail,a+detail)], shade)
    for i in range(detail):
        mesh(name, vertices, [(rings*detail+i, rings*detail+(i+1)%detail,len(vertices)-1)], 'moss')


def foliage(center, scale, seed):
    rng = random.Random(seed)
    x,y,z = center
    vertices = [(x,y,z+scale[2])]
    sides = 13
    for ring in range(2):
        for i in range(sides):
            angle = i/sides*math.tau
            radius = rng.uniform(.63,1.18)*(1 if ring == 0 else .68)
            vertices.append((x+math.cos(angle)*scale[0]*radius, y+math.sin(angle)*scale[1]*radius,
                             z + (.1 if ring == 0 else -.6)*scale[2]+rng.uniform(-.07,.07)))
    vertices.append((x,y,z-scale[2]*.7))
    faces = []
    for i in range(sides):
        j = (i+1)%sides
        faces.extend([(0,1+i,1+j),(1+i,1+sides+i,1+sides+j,1+j),(1+sides*2,1+sides+j,1+sides+i)])
    mesh('Pine canopies', vertices, faces, f'leaf_{rng.randrange(5)}')


def pine(x,y,z,s,seed):
    rng = random.Random(seed)
    lean = rng.uniform(-.45,.45)*s
    trunk = [(x,y,z),(x+lean*.35,y,z+s*.6),(x+lean,y+s*.1,z+s*1.4),(x+lean*.6,y,z+s*2.05)]
    tube('Twisted pine trunks',trunk,.09*s,'wood',7,.35)
    for j in range(6):
        angle = rng.random()*math.tau
        start = Vector(trunk[1]).lerp(Vector(trunk[3]),j/7)
        end = start+Vector((math.cos(angle)*s*.7,math.sin(angle)*s*.7,s*.2))
        mid = start.lerp(end,.55)+Vector((0,0,-.08*s))
        tube('Pine branches',[start,mid,end],.043*s,'wood',5,.25)
        foliage(end,(s*.75,s*.53,s*.27),seed+j)
        for k in range(3):
            angle = rng.random()*math.tau
            foliage(end+Vector((math.cos(angle)*s*.42,math.sin(angle)*s*.34,s*.06)),(s*.33,s*.3,s*.16),seed+j+k+117)
        foliage(end+Vector((s*.2,0,s*.1)),(s*.4,s*.45,s*.16),seed+j+17)
    foliage(trunk[-1],(s*.64,s*.46,s*.2),seed+99)


def roof(x,y,z,w,d,h,name):
    def point(u,v):
        # Concave tiled slopes; ridge and upturned eaves are actual geometry.
        return (x+u*w/2,y+v*d/2,z+h*(1-abs(v)**.62)+.32*abs(u)**8+.17*abs(v)**12)
    nx,ny = 30,20
    vertices = [point(-1+2*i/nx,-1+2*j/ny) for i in range(nx+1) for j in range(ny+1)]
    faces = [(i*(ny+1)+j,(i+1)*(ny+1)+j,(i+1)*(ny+1)+j+1,i*(ny+1)+j+1) for i in range(nx) for j in range(ny)]
    mesh(name,vertices,faces,'roof')
    for v in [-1,1]:
        tube(name,[point(-1+2*i/30,v) for i in range(31)],.062,'roofEdge',6)
    for u in [-1,1]:
        tube(name,[point(u,-1+2*i/20) for i in range(21)],.063,'roofEdge',6)
    for i in range(33):
        u = -1+2*i/32
        for side in [-1,1]:
            tube(name,[tuple(Vector(point(u,side*j/10))+Vector((0,0,.035))) for j in range(11)],.023,'roofEdge',4)
    tube(name,[(x-w*.52,y,z+h+.37),(x-w*.45,y,z+h+.12),(x+w*.45,y,z+h+.12),(x+w*.52,y,z+h+.37)],.09,'roofEdge',6)


def lantern(x,y,z,s=1):
    box('Stone lanterns',(x,y,z+.1*s),(.35*s,.35*s,.2*s),'stoneLight')
    box('Stone lanterns',(x,y,z+.5*s),(.15*s,.15*s,.8*s),'stoneLight')
    box('Stone lanterns',(x,y,z+1*s),(.32*s,.32*s,.3*s),'wood')
    roof(x,y,z+1.15*s,.65*s,.58*s,.2*s,'Lantern roofs')


def gate(ch):
    x,y,z = ch['position']
    name = 'Gate '+ch['id']
    box(name,(x,y,z+.12),(4.3,3.1,.3),'stoneLight')
    for j in range(9):
        box(name,(x,y-1.5-j*.24,z-.05-j*.11),(3.25,.27,.22),'stoneLight')
    box(name,(x,y+.1,z+2.7),(3.45,1.5,5.4),'plaster')
    for dx in [-1.85,1.85]:
        box(name,(x+dx,y,z+2.65),(.48,1.9,5.3),'stone')
        box(name,(x+dx,y,z+.38),(.72,2.12,.5),'stoneLight')
        box(name,(x+dx,y,z+5.1),(.7,2.05,.36),'stoneLight')
        # Segmented masonry on the front buttresses.
        for j in range(10):
            box(name,(x+dx,y-.965,z+.8+j*.4),(.49,.04,.035),'stoneDark')
    box(name,(x,y-.69,z+2.85),(2.95,.08,4.08),'plaster')
    for dx in [-1.52,1.52]:
        box(name,(x+dx,y-.76,z+2.9),(.055,.06,4.25),'roofEdge')
    for zz in [.79,5.02]:
        box(name,(x,y-.76,z+zz),(3.1,.06,.055),'roofEdge')
    box(name,(x,y,z+5.42),(4.45,2.2,.26),'wood')
    for dx in [-1.6,-.8,0,.8,1.6]:
        box(name,(x+dx,y-.55,z+5.6),(.13,1.65,.32),'roofEdge')
    roof(x,y,z+5.67,5.2,3.1,.83,name)
    box(name,(x,y+.12,z+6.55),(3.5,1.2,.35),'wood')
    roof(x,y+.12,z+6.7,4.3,2.05,.58,name)
    for dx in [-2.08,2.08]:
        lantern(x+dx,y-1.22,z+.3,.62)


def bridge(a,b):
    pa,pb = Vector(a['position']),Vector(b['position'])
    direction = pb-pa
    horizontal = Vector((direction.x,direction.y,0)).normalized()
    side = Vector((-horizontal.y,horizontal.x,0))
    start = pa+horizontal*a['radius']*.69
    end = pb-horizontal*b['radius']*.69
    distance = (end-start).length
    segments = max(12,int(distance/.25))
    angle = math.atan2(horizontal.y,horizontal.x)
    def p(t):
        pos = start.lerp(end,t)
        pos.z += .22 + math.sin(t*math.pi)*.65
        return pos
    for j in range(segments):
        pos = p((j+.5)/segments)
        box('Stepped stone bridges',pos,(distance/segments+.035,1.05,.16),'stoneLight',angle)
    for s in [-1,1]:
        for level in [.42,.78]:
            tube('Bridge balustrades',[p(j/segments)+side*s*.52+Vector((0,0,level)) for j in range(segments+1)],.045,'stoneLight',5)
        for j in range(0,segments+1,3):
            pos = p(j/segments)+side*s*.52
            tube('Bridge posts',[pos,pos+Vector((0,0,.92))],.067,'stoneLight',5)
            box('Bridge finials',pos+Vector((0,0,.94)),(.2,.2,.12),'roofEdge')
    tube('Bridge structure',[p(j/segments)+Vector((0,0,-.23)) for j in range(segments+1)],.17,'stone',6)


for index,ch in enumerate(CONFIG['chapters']):
    x,y,z = ch['position']
    r,h = ch['radius'],ch['height']
    rock('Mountain '+ch['id'],(x,y,z),(r,r*.83,h),index*137+3,44,32)
    # Long, fractured satellite columns make the rock read as a cliff, not a cone.
    for j in range(17):
        angle = j/17*math.tau
        rr = random.uniform(.65,.95)*r
        size = random.uniform(.22,.43)*r
        top = z+random.uniform(-2.5,.25)
        rock('Mountain '+ch['id'],(x+math.cos(angle)*rr,y+math.sin(angle)*rr*.85,top),
             (size,size*.75,h*random.uniform(.4,.9)),index*200+j+22,16,18)
        if j%3 == 0:
            pine(x+math.cos(angle)*rr,y+math.sin(angle)*rr*.85,top,.5+random.random()*.4,index*30+j)
    gate(ch)
    for j in range(5):
        angle = random.uniform(0,math.tau)
        px,py = x+math.cos(angle)*r*.85,y+math.sin(angle)*r*.7
        pine(px,py,z-.25,random.uniform(.8,1.25),1000+index*20+j)
    # Small sanctuaries tucked into the mountain shoulders.
    px,py = x+r*.75,y+.4
    roof(px,py,z+1,1.25,1.1,.38,'Wayside pavilions')
    for dx in [-.42,.42]:
        for dy in [-.35,.35]:
            box('Wayside pavilions',(px+dx,py+dy,z+.52),(.08,.08,1),'wood')
    if index in [0,4,5,6,8]:
        # Individual pale ribbons follow the front cliff; animated water is optional in the viewer.
        for j in range(5):
            wx = x+r*.55+j*.10
            wy = y-r*.55
            length = h*random.uniform(.45,.7)
            tube('Waterfall ribbons',[(wx,wy,z-.6),(wx+.12,wy-.17,z-1.5),(wx+.2,wy-.3,z-length)],.04+random.random()*.035,'water',5,.6)

for a,b in CONFIG['bridges']:
    bridge(CONFIG['chapters'][a],CONFIG['chapters'][b])

for j in range(22):
    x = random.choice([-1,1])*random.uniform(17,30)
    y = random.uniform(-4,28)
    z = random.uniform(-5,10)
    r = random.uniform(.6,2.1)
    rock('Distant floating isles',(x,y,z),(r,r*.8,r*3.8),7000+j,12,9)
    pine(x,y,z,.35+r*.3,8000+j)

# Build the source objects and export the same geometry consumed by Three.js.
for (name,mat),(vertices,faces) in PARTS.items():
    data = bpy.data.meshes.new(name+' mesh')
    data.from_pydata(vertices,[],faces)
    data.materials.append(MATERIALS[mat])
    data.update()
    obj = bpy.data.objects.new(name+' | '+mat,data)
    bpy.context.collection.objects.link(obj)

font = bpy.data.fonts.load('C:/Windows/Fonts/simsun.ttc')
for ch in CONFIG['chapters']:
    x,y,z = ch['position']
    for body,size,zz in [(ch['id'],.72,4.05),(ch['title'],.37,3.35),(ch['topics'].replace(' / ','\n'),.16,2.65)]:
        curve = bpy.data.curves.new('Inscription '+ch['id'],'FONT')
        curve.body = body
        curve.align_x = 'CENTER'
        curve.size = size
        curve.space_line = 1.45
        curve.resolution_u = 4
        curve.font = font
        curve.extrude = .001
        curve.materials.append(MATERIALS['ink'])
        obj = bpy.data.objects.new('Inscription '+ch['id'],curve)
        bpy.context.collection.objects.link(obj)
        obj.location = (x,y-.815,z+zz)
        obj.rotation_euler = (math.pi/2,0,0)
        bpy.context.view_layer.objects.active = obj
        obj.select_set(True)
        bpy.ops.object.convert(target='MESH')
        obj.select_set(False)

# Weld duplicate vertices introduced by per-face color batching.
import bmesh
for obj in list(bpy.context.scene.objects):
    bm = bmesh.new()
    bm.from_mesh(obj.data)
    bmesh.ops.remove_doubles(bm,verts=list(bm.verts),dist=.0001)
    bm.to_mesh(obj.data)
    bm.free()

scene = bpy.context.scene
scene.world.color = (.65,.68,.62)
scene.world.use_nodes = True
scene.world.node_tree.nodes['Background'].inputs[0].default_value = (.72,.76,.7,1)
scene.world.node_tree.nodes['Background'].inputs[1].default_value = .65
bpy.ops.object.light_add(type='AREA',location=(-15,-18,38))
bpy.context.object.name = 'Soft afternoon key'
bpy.context.object.data.energy = 4200
bpy.context.object.data.shape = 'DISK'
bpy.context.object.data.size = 22
bpy.context.object.rotation_euler = (Vector((0,2,7))-bpy.context.object.location).to_track_quat('-Z','Y').to_euler()
bpy.ops.object.camera_add(location=(24,-49,31))
camera = bpy.context.object
camera.rotation_euler = (Vector((1,3,7))-camera.location).to_track_quat('-Z','Y').to_euler()
camera.data.type = 'ORTHO'
camera.data.ortho_scale = 54
scene.camera = camera
scene.render.engine = 'CYCLES'
scene.cycles.samples = 32
scene.render.resolution_x = 1600
scene.render.resolution_y = 1100
scene.render.resolution_percentage = 100
scene.view_settings.view_transform = 'AgX'
for area in bpy.context.screen.areas:
    if area.type == 'VIEW_3D':
        area.spaces.active.region_3d.view_perspective = 'CAMERA'

source = ROOT/'assets/intro'
public = ROOT/'public/models'
source.mkdir(parents=True,exist_ok=True)
public.mkdir(parents=True,exist_ok=True)
bpy.context.preferences.filepaths.save_version = 0
bpy.ops.wm.save_as_mainfile(filepath=str(source/'cloud-mountains.blend'),compress=True)
# Keep editable source groupings above; consolidate only the web export by material.
groups = {}
for obj in list(scene.objects):
    if obj.type == 'MESH':
        groups.setdefault(obj.data.materials[0].name,[]).append(obj)
for mat,objects in groups.items():
    bpy.ops.object.select_all(action='DESELECT')
    for obj in objects:
        obj.select_set(True)
    bpy.context.view_layer.objects.active = objects[0]
    bpy.ops.object.join()
    bpy.context.object.name = 'Web batch | '+mat
bpy.ops.export_scene.gltf(filepath=str(public/'cloud-mountains.glb'),export_format='GLB',
                          export_cameras=False,export_lights=False,export_yup=True,
                          export_draco_mesh_compression_enable=True,export_draco_mesh_compression_level=6)
stats = {'sourceGroups':len(PARTS),'webMeshes':len(groups),'triangles':sum(len(o.data.loop_triangles) for o in scene.objects if o.type=='MESH'),
         'glbBytes':(public/'cloud-mountains.glb').stat().st_size,'seed':CONFIG['seed']}
for o in scene.objects:
    if o.type == 'MESH':
        o.data.calc_loop_triangles()
stats['triangles'] = sum(len(o.data.loop_triangles) for o in scene.objects if o.type=='MESH')
(source/'build-stats.json').write_text(json.dumps(stats,indent=2)+'\n',encoding='utf-8')
print('INTRO_BUILD',json.dumps(stats))
