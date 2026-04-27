import urllib.request
import re

html = urllib.request.urlopen('https://developer.android.com/reference/kotlin/androidx/health/connect/client/records/ExerciseSegment').read().decode('utf-8')
matches = re.findall(r'EXERCISE_SEGMENT_TYPE_([A-Z_]+)(?:(?!EXERCISE_SEGMENT_TYPE).)*?(?=>\s*=\s*)>\s*=\s*(\d+)', html, re.DOTALL)

mapping = {}
for name, val in matches:
    clean_name = name.replace("_", " ").title()
    mapping[int(val)] = clean_name

out = "const SEGMENT_TYPES = {\n"
for k in sorted(mapping.keys()):
    out += f"    {k}: '{mapping[k]}',\n"
out += "};\n"

print(out)
