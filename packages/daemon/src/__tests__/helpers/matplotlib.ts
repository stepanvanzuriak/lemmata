import { execFileSync } from "node:child_process";

/** The four-angle strip of a 3D figure is stitched with Pillow, which a bare Python install lacks. */
export const hasPillow = (() => {
  try {
    execFileSync("python3", ["-c", "import PIL"], { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
})();

export const STUB_PYPLOT = `
import sys, types, base64
_PNG = base64.b64decode("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==")

class _Axes:
    def __init__(self, name="rectilinear", title=""):
        self.name, self._title, self.elev, self.azim = name, title, 30, -60
    def get_title(self):
        return self._title
    def view_init(self, elev=None, azim=None):
        self.elev, self.azim = elev, azim

class _Figure:
    def __init__(self, axes):
        self.axes = axes
    def savefig(self, target, **kw):
        if hasattr(target, "write"):
            target.write(_PNG)
        else:
            open(target, "wb").write(_PNG)

_figs = {}
plt = types.ModuleType("matplotlib.pyplot")
plt.get_fignums = lambda: sorted(_figs)
plt.figure = lambda n: _figs[n]
def _plot(n, name="rectilinear", title=""):
    _figs[n] = _Figure([_Axes(name, title)])
plt._plot = _plot
sys.modules["matplotlib.pyplot"] = plt
`;
