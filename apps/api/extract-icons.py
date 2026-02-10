"""Extract all icons from the diagrams library with their types and module paths."""
import os, importlib, inspect, json

base = os.path.join(
    os.path.dirname(importlib.import_module('diagrams').__file__)
)

icons = {}  # icon_filename -> { types: [], modules: [], classes: [] }

for provider in sorted(os.listdir(base)):
    pdir = os.path.join(base, provider)
    if not os.path.isdir(pdir) or provider.startswith('_'):
        continue
    for f in sorted(os.listdir(pdir)):
        if f.endswith('.py') and f != '__init__.py':
            module_name = f[:-3]
            modpath = f'diagrams.{provider}.{module_name}'
            try:
                mod = importlib.import_module(modpath)
                for name, obj in inspect.getmembers(mod, inspect.isclass):
                    if obj.__module__ == modpath and not name.startswith('_'):
                        _type = getattr(obj, '_type', None)
                        _icon = getattr(obj, '_icon', None)
                        if _type and _icon:
                            icon_key = _icon.replace('.png', '')
                            if icon_key not in icons:
                                icons[icon_key] = {
                                    'types': [],
                                    'modules': [],
                                    'classes': []
                                }
                            if _type not in icons[icon_key]['types']:
                                icons[icon_key]['types'].append(_type)
                            mod_short = f'{provider}.{module_name}'
                            if mod_short not in icons[icon_key]['modules']:
                                icons[icon_key]['modules'].append(mod_short)
                            icons[icon_key]['classes'].append(f'{provider}.{module_name}.{name}')
            except Exception as e:
                pass

# Sort types for consistency
for v in icons.values():
    v['types'].sort()
    v['modules'].sort()
    v['classes'].sort()

# Stats
total_icons = len(icons)
multi_type = sum(1 for v in icons.values() if len(v['types']) > 1)
all_types = set()
for v in icons.values():
    all_types.update(v['types'])

print(f'Total unique icons: {total_icons}')
print(f'Icons with multiple types: {multi_type}')
print(f'Unique _type values: {len(all_types)}')
print(f'Types: {sorted(all_types)}')

# Write to JSON
output_path = os.path.join(os.getcwd(), 'src', 'vulndb', 'bridge', 'icon-registry.json')
with open(output_path, 'w') as f:
    json.dump(icons, f, indent=2, sort_keys=True)
print(f'\nWritten to {output_path}')
