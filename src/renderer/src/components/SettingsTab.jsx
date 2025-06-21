import { Switch } from './ui/switch'
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from './ui/select'

const SettingsTab = ({ settings, autoLaunch, onSettingsChange, onAutoLaunchChange }) => {
  const currentYear = new Date().getFullYear()

  return (
    <div className="w-full flex flex-col gap-4">
      {/* Always on top */}
      <div className="flex flex-row items-center justify-between rounded-lg border p-4 shadow-sm bg-card/80">
        <div className="space-y-0.5">
          <div className="font-medium">Always on top</div>
          <div className="text-muted-foreground text-sm">
            Keep the window always on top of other windows.
          </div>
        </div>
        <Switch
          checked={settings.alwaysOnTop}
          onCheckedChange={(v) => onSettingsChange('alwaysOnTop', v)}
        />
      </div>

      {/* Start on system startup */}
      <div className="flex flex-row items-center justify-between rounded-lg border p-4 shadow-sm bg-card/80">
        <div className="space-y-0.5">
          <div className="font-medium">Start on system startup</div>
          <div className="text-muted-foreground text-sm">
            Launch the app automatically when your system starts.
          </div>
        </div>
        <Switch checked={autoLaunch} onCheckedChange={onAutoLaunchChange} />
      </div>

      {/* Hide sticker capture */}
      <div className="flex flex-row items-center justify-between rounded-lg border p-4 shadow-sm bg-card/80">
        <div className="space-y-0.5">
          <div className="font-medium">Hide sticker capture</div>
          <div className="text-muted-foreground text-sm">
            Protect stickers from being captured in screenshots.
          </div>
        </div>
        <Switch
          checked={settings.hideStickerCapture}
          onCheckedChange={(v) => onSettingsChange('hideStickerCapture', v)}
        />
      </div>

      {/* Theme select */}
      <div className="flex flex-row items-center justify-between rounded-lg border p-4 shadow-sm bg-card/80">
        <div className="space-y-0.5">
          <div className="font-medium">Theme</div>
          <div className="text-muted-foreground text-sm">Choose between dark and light mode.</div>
        </div>
        <Select value={settings.theme} onValueChange={(v) => onSettingsChange('theme', v)}>
          <SelectTrigger className="w-32">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="dark">Dark</SelectItem>
            <SelectItem value="light">Light</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Footer */}
      <div className="text-sm text-muted-foreground">
        Made with ♥ by Momo © {currentYear}
      </div>
    </div>
  )
}

export default SettingsTab
