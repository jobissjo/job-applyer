# Rasterize the existing frontend briefcase mark for Expo app assets.
# Geometry matches frontend/public/favicon.svg; no external image tooling needed.
Add-Type -AssemblyName System.Drawing
$assetDirectory = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../assets/images'))
foreach ($transparent in @($false, $true)) {
    $bitmap = [System.Drawing.Bitmap]::new(1024, 1024)
    $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
    $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
    $graphics.Clear($(if ($transparent) { [System.Drawing.Color]::Transparent } else { [System.Drawing.ColorTranslator]::FromHtml('#177c70') }))
    $graphics.ScaleTransform(25.6, 25.6)
    $pen = [System.Drawing.Pen]::new([System.Drawing.Color]::White, 2)
    $pen.StartCap = [System.Drawing.Drawing2D.LineCap]::Round
    $pen.EndCap = [System.Drawing.Drawing2D.LineCap]::Round
    $pen.LineJoin = [System.Drawing.Drawing2D.LineJoin]::Round
    $body = [System.Drawing.Drawing2D.GraphicsPath]::new()
    $body.AddArc(10, 14, 4, 4, 180, 90)
    $body.AddArc(26, 14, 4, 4, 270, 90)
    $body.AddArc(26, 25, 4, 4, 0, 90)
    $body.AddArc(10, 25, 4, 4, 90, 90)
    $body.CloseFigure()
    $graphics.DrawPath($pen, $body)
    $graphics.DrawLines($pen, [System.Drawing.PointF[]]@(
        [System.Drawing.PointF]::new(16, 14), [System.Drawing.PointF]::new(16, 10),
        [System.Drawing.PointF]::new(24, 10), [System.Drawing.PointF]::new(24, 14)
    ))
    $graphics.DrawBezier($pen, 10, 20, 16, 24, 24, 24, 30, 20)
    $graphics.DrawLine($pen, 20, 20, 20, 24)
    $filename = if ($transparent) { 'applypilot-mark.png' } else { 'applypilot-icon.png' }
    $bitmap.Save((Join-Path $assetDirectory $filename), [System.Drawing.Imaging.ImageFormat]::Png)
    $body.Dispose(); $pen.Dispose(); $graphics.Dispose(); $bitmap.Dispose()
}
