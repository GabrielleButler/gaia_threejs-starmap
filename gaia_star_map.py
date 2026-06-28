import ssl
import certifi
import json
import math
import numpy as np
from astroquery.gaia import Gaia

# -------------------------
# SSL FIX
# -------------------------
ssl._create_default_https_context = lambda: ssl.create_default_context(
    cafile=certifi.where()
)

# -------------------------
# GAIA QUERY
# -------------------------
query = """
SELECT TOP 25000
    source_id,
    ra,
    dec,
    parallax,
    phot_g_mean_mag,
    bp_rp
FROM gaiadr3.gaia_source
WHERE parallax > 10
ORDER BY phot_g_mean_mag
"""

job = Gaia.launch_job(query)
results = job.get_results()

print("Stars retrieved:", len(results))

# -------------------------
# SAFE CONVERSION
# -------------------------
def clean(v):
    try:
        if v is None:
            return None

        # astropy masked value protection
        if hasattr(v, "mask"):
            if v.mask:
                return None

        if isinstance(v, str):
            return None

        v = float(v)

        if v != v:  # catches NaN (important trick)
            return None

        if v == float("inf") or v == float("-inf"):
            return None

        return v

    except:
        return None
# -------------------------
# COMPUTE 3D POSITIONS
# -------------------------
ra = np.radians(results['ra'])
dec = np.radians(results['dec'])

parallax = results['parallax']

distance = []
for p in parallax:
    p = clean(p)
    if p is None or p <= 0:
        distance.append(None)
    else:
        distance.append(1000.0 / p)

# IMPORTANT: convert to arrays AFTER building safely
distance = np.array(distance, dtype=object)

x = distance * np.cos(dec) * np.cos(ra)
y = distance * np.cos(dec) * np.sin(ra)
z = distance * np.sin(dec)

# -------------------------
# EXPORT CLEAN STARS
# -------------------------
stars = []

for i in range(len(results)):

    x_i = clean(x[i])
    y_i = clean(y[i])
    z_i = clean(z[i])

    if x_i is None or y_i is None or z_i is None:
        continue

    mag = clean(results['phot_g_mean_mag'][i])
    bp_rp = clean(results['bp_rp'][i])

    stars.append({
        "source_id": int(results['source_id'][i]),
        "x": x_i,
        "y": y_i,
        "z": z_i,
        "mag": mag,
        "color_index": bp_rp
    })

# FINAL SAFETY FILTER (removes hidden NaNs)
clean_stars = []
for s in stars:
    if (
        s["x"] is not None and
        s["y"] is not None and
        s["z"] is not None
    ):
        clean_stars.append(s)

# -------------------------
# WRITE JSON
# -------------------------
with open("stars.json", "w") as f:
    json.dump({"stars": clean_stars}, f)

print("Saved stars:", len(clean_stars))