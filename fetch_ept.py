import urllib.request
import json
import laspy
import io
import csv

BASE_URL = "http://usgs-lidar-public.s3.amazonaws.com/WY_FEMA_East_B2_2019/"
EPT_URL = BASE_URL + "ept.json"

target_min_x, target_max_x = -11701162.28359559, -11671508.933600606
target_min_y, target_max_y = 5339410.23089121, 5340984.172737586

def get_json(url):
    with urllib.request.urlopen(url) as r:
        return json.loads(r.read())

print("Fetching EPT metadata...")
ept = get_json(EPT_URL)
root_bounds = ept["bounds"] # [minx, miny, minz, maxx, maxy, maxz]
root_span = root_bounds[3] - root_bounds[0]
print("Root bounds:", root_bounds)

# EPT octree logic
def intersects(node_bounds):
    minx, miny, minz, maxx, maxy, maxz = node_bounds
    if minx > target_max_x or maxx < target_min_x: return False
    if miny > target_max_y or maxy < target_min_y: return False
    return True

def get_node_bounds(key):
    # key is depth-x-y-z
    d, x, y, z = map(int, key.split('-'))
    step = root_span / (2 ** d)
    minx = root_bounds[0] + x * step
    miny = root_bounds[1] + y * step
    minz = root_bounds[2] + z * step
    return [minx, miny, minz, minx+step, miny+step, minz+step]

print("Fetching hierarchy...")
hierarchy = get_json(BASE_URL + "ept-hierarchy/0-0-0-0.json")

# Find intersecting nodes
intersecting_nodes = []
for key, num_points in hierarchy.items():
    if num_points == -1: continue # Reference to another hierarchy file
    bounds = get_node_bounds(key)
    if intersects(bounds):
        intersecting_nodes.append((key, num_points))

# Sort by depth (shallow to deep) and pick up to N nodes to keep it fast
# e.g., we just want a good sample, so maybe 5 deep nodes
intersecting_nodes.sort(key=lambda x: int(x[0].split('-')[0]), reverse=True)
nodes_to_fetch = intersecting_nodes[:15]

print(f"Found {len(intersecting_nodes)} intersecting nodes. Fetching top {len(nodes_to_fetch)} deepest nodes...")

all_points = []

for key, pts in nodes_to_fetch:
    url = BASE_URL + f"ept-data/{key}.laz"
    try:
        req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
        with urllib.request.urlopen(req) as response:
            data = response.read()
            las = laspy.read(io.BytesIO(data))
            
            # Filter exactly
            mask = (las.x >= target_min_x) & (las.x <= target_max_x) & \
                   (las.y >= target_min_y) & (las.y <= target_max_y) & \
                   (las.return_number == 1) # groups="first"
                   
            filtered = las.points[mask]
            
            for i in range(len(filtered)):
                all_points.append({
                    'x': filtered.x[i],
                    'y': filtered.y[i],
                    'z': filtered.z[i],
                    'type': filtered.classification[i]
                })
                
            print(f"Node {key}: {len(filtered)} points inside target bounds (out of {pts}).")
            if len(all_points) > 50000:
                print("Reached 50k points limit, stopping.")
                break
    except Exception as e:
        print(f"Failed to fetch {key}: {e}")

csv_filename = "wy_fema_extracted.csv"
print(f"Writing {len(all_points)} points to {csv_filename}...")
with open(csv_filename, "w", newline="") as f:
    writer = csv.writer(f)
    writer.writerow(["x", "y", "z", "type"])
    for p in all_points:
        writer.writerow([round(p['x'], 2), round(p['y'], 2), round(p['z'], 2), p['type']])
        
print("Done!")
