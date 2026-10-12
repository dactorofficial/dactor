package com.dactor.clinic.ui.components

import android.Manifest
import android.annotation.SuppressLint
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.location.Geocoder
import android.location.Location
import android.location.LocationListener
import android.location.LocationManager
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.os.Looper
import android.provider.Settings
import android.webkit.JavascriptInterface
import android.webkit.WebChromeClient
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.border
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.viewinterop.AndroidView
import androidx.compose.ui.window.Dialog
import androidx.compose.ui.window.DialogProperties
import androidx.core.content.ContextCompat
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import java.util.Locale

@SuppressLint("SetJavaScriptEnabled")
@Composable
fun OpenStreetMapPicker(
    initialAddress: String,
    initialLat: Double,
    initialLng: Double,
    onSaveLocation: (address: String, lat: Double, lng: Double) -> Unit,
    onDismiss: () -> Unit
) {
    var addressText by remember { mutableStateOf(initialAddress.ifBlank { "Kathmandu, Nepal" }) }
    var currentLat by remember { mutableDoubleStateOf(if (initialLat != 0.0) initialLat else 27.7052) }
    var currentLng by remember { mutableDoubleStateOf(if (initialLng != 0.0) initialLng else 85.3193) }

    var webViewRef by remember { mutableStateOf<WebView?>(null) }

    val context = androidx.compose.ui.platform.LocalContext.current
    val coroutineScope = rememberCoroutineScope()
    var isFetchingLocation by remember { mutableStateOf(false) }
    var showEnableGpsDialog by remember { mutableStateOf(false) }
    var showPermissionSettingsDialog by remember { mutableStateOf(false) }

    fun isDeviceLocationEnabled(): Boolean {
        val locManager = context.getSystemService(Context.LOCATION_SERVICE) as? LocationManager ?: return false
        return try {
            locManager.isProviderEnabled(LocationManager.GPS_PROVIDER) ||
                locManager.isProviderEnabled(LocationManager.NETWORK_PROVIDER)
        } catch (e: Exception) {
            false
        }
    }

    fun reverseGeocode(lat: Double, lng: Double) {
        coroutineScope.launch(Dispatchers.IO) {
            try {
                val geocoder = Geocoder(context, Locale.getDefault())
                val addresses = geocoder.getFromLocation(lat, lng, 1)
                if (!addresses.isNullOrEmpty()) {
                    val addr = addresses[0]
                    val parts = listOfNotNull(
                        addr.featureName,
                        addr.subLocality,
                        addr.locality,
                        addr.subAdminArea,
                        addr.adminArea
                    ).distinct()
                    val addrStr = parts.joinToString(", ")
                    if (addrStr.isNotBlank()) {
                        withContext(Dispatchers.Main) {
                            addressText = addrStr
                        }
                    }
                }
            } catch (ignored: Exception) {}
        }
    }

    fun applyLocationResult(lat: Double, lng: Double) {
        coroutineScope.launch(Dispatchers.IO) {
            var addressResult = ""
            try {
                val geocoder = Geocoder(context, Locale.getDefault())
                val addresses = geocoder.getFromLocation(lat, lng, 1)
                if (!addresses.isNullOrEmpty()) {
                    val addr = addresses[0]
                    val parts = listOfNotNull(
                        addr.featureName,
                        addr.subLocality,
                        addr.locality,
                        addr.subAdminArea,
                        addr.adminArea
                    ).distinct()
                    addressResult = parts.joinToString(", ")
                }
            } catch (ignored: Exception) {}

            if (addressResult.isBlank()) {
                addressResult = "Location (${String.format(Locale.US, "%.5f", lat)}, ${String.format(Locale.US, "%.5f", lng)})"
            }

            withContext(Dispatchers.Main) {
                currentLat = lat
                currentLng = lng
                addressText = addressResult
                isFetchingLocation = false
                webViewRef?.evaluateJavascript("if(window.moveToCoords) window.moveToCoords($lat, $lng);", null)
            }
        }
    }

    fun executeGpsFetch() {
        val locManager = context.getSystemService(Context.LOCATION_SERVICE) as? LocationManager
        if (locManager == null) {
            isFetchingLocation = false
            return
        }

        if (!isDeviceLocationEnabled()) {
            isFetchingLocation = false
            showEnableGpsDialog = true
            return
        }

        isFetchingLocation = true

        // 1. Check last known location as immediate response
        var lastBest: Location? = null
        val providers = listOf(LocationManager.GPS_PROVIDER, LocationManager.NETWORK_PROVIDER, LocationManager.PASSIVE_PROVIDER)
        for (p in providers) {
            try {
                val loc = locManager.getLastKnownLocation(p)
                if (loc != null && (lastBest == null || loc.accuracy < lastBest.accuracy)) {
                    lastBest = loc
                }
            } catch (ignored: Exception) {}
        }
        if (lastBest != null) {
            applyLocationResult(lastBest.latitude, lastBest.longitude)
        }

        // 2. Actively query hardware GPS / Network provider for real live fix
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
                val provider = when {
                    locManager.isProviderEnabled(LocationManager.GPS_PROVIDER) -> LocationManager.GPS_PROVIDER
                    locManager.isProviderEnabled(LocationManager.NETWORK_PROVIDER) -> LocationManager.NETWORK_PROVIDER
                    else -> LocationManager.PASSIVE_PROVIDER
                }
                locManager.getCurrentLocation(provider, null, context.mainExecutor) { liveLoc ->
                    if (liveLoc != null) {
                        applyLocationResult(liveLoc.latitude, liveLoc.longitude)
                    } else if (provider == LocationManager.GPS_PROVIDER && locManager.isProviderEnabled(LocationManager.NETWORK_PROVIDER)) {
                        locManager.getCurrentLocation(LocationManager.NETWORK_PROVIDER, null, context.mainExecutor) { netLoc ->
                            if (netLoc != null) {
                                applyLocationResult(netLoc.latitude, netLoc.longitude)
                            } else {
                                coroutineScope.launch(Dispatchers.Main) { isFetchingLocation = false }
                            }
                        }
                    } else {
                        coroutineScope.launch(Dispatchers.Main) { isFetchingLocation = false }
                    }
                }
            } else {
                val listener = object : LocationListener {
                    override fun onLocationChanged(loc: Location) {
                        locManager.removeUpdates(this)
                        applyLocationResult(loc.latitude, loc.longitude)
                    }
                    @Deprecated("Deprecated in Java")
                    override fun onStatusChanged(p: String?, s: Int, e: Bundle?) {}
                    override fun onProviderEnabled(p: String) {}
                    override fun onProviderDisabled(p: String) {}
                }
                if (locManager.isProviderEnabled(LocationManager.GPS_PROVIDER)) {
                    locManager.requestSingleUpdate(LocationManager.GPS_PROVIDER, listener, Looper.getMainLooper())
                } else if (locManager.isProviderEnabled(LocationManager.NETWORK_PROVIDER)) {
                    locManager.requestSingleUpdate(LocationManager.NETWORK_PROVIDER, listener, Looper.getMainLooper())
                }
            }
        } catch (e: Exception) {
            e.printStackTrace()
            if (lastBest == null) {
                coroutineScope.launch(Dispatchers.Main) { isFetchingLocation = false }
            }
        }
    }

    val gpsSettingsLauncher = rememberLauncherForActivityResult(
        contract = ActivityResultContracts.StartActivityForResult()
    ) {
        if (isDeviceLocationEnabled()) {
            executeGpsFetch()
        }
    }

    val locationPermLauncher = rememberLauncherForActivityResult(
        contract = ActivityResultContracts.RequestMultiplePermissions()
    ) { perms ->
        val granted = perms[Manifest.permission.ACCESS_FINE_LOCATION] == true ||
                      perms[Manifest.permission.ACCESS_COARSE_LOCATION] == true
        if (granted) {
            executeGpsFetch()
        } else {
            isFetchingLocation = false
            showPermissionSettingsDialog = true
        }
    }

    fun fetchCurrentGpsLocation() {
        val hasFine = ContextCompat.checkSelfPermission(context, Manifest.permission.ACCESS_FINE_LOCATION) == PackageManager.PERMISSION_GRANTED
        val hasCoarse = ContextCompat.checkSelfPermission(context, Manifest.permission.ACCESS_COARSE_LOCATION) == PackageManager.PERMISSION_GRANTED
        if (hasFine || hasCoarse) {
            executeGpsFetch()
        } else {
            locationPermLauncher.launch(
                arrayOf(Manifest.permission.ACCESS_FINE_LOCATION, Manifest.permission.ACCESS_COARSE_LOCATION)
            )
        }
    }

    // Automatically request permission if not yet granted when opening picker
    LaunchedEffect(Unit) {
        val hasFine = ContextCompat.checkSelfPermission(context, Manifest.permission.ACCESS_FINE_LOCATION) == PackageManager.PERMISSION_GRANTED
        val hasCoarse = ContextCompat.checkSelfPermission(context, Manifest.permission.ACCESS_COARSE_LOCATION) == PackageManager.PERMISSION_GRANTED
        if (!hasFine && !hasCoarse) {
            locationPermLauncher.launch(
                arrayOf(Manifest.permission.ACCESS_FINE_LOCATION, Manifest.permission.ACCESS_COARSE_LOCATION)
            )
        } else if (initialAddress.isBlank()) {
            executeGpsFetch()
        }
    }

    val nepalPresets = remember {
        listOf(
            Triple("Kathmandu (Bagbazar)", 27.7052, 85.3193),
            Triple("Patan (Lagankhel)", 27.6685, 85.3214),
            Triple("Thamel / Lazimpat", 27.7172, 85.3120),
            Triple("Maharajgunj (TUTH)", 27.7360, 85.3305),
            Triple("Bhaktapur", 27.6710, 85.4298),
            Triple("Pokhara (Lakeside)", 28.2096, 83.9856),
            Triple("Chitwan (Bharatpur)", 27.6833, 84.4333),
            Triple("Biratnagar", 26.4525, 87.2718),
            Triple("Butwal", 27.7006, 83.4484),
            Triple("Dharan (BPKIHS)", 26.8124, 87.2834)
        )
    }

    Dialog(
        onDismissRequest = onDismiss,
        properties = DialogProperties(usePlatformDefaultWidth = false)
    ) {
        Surface(
            modifier = Modifier
                .fillMaxWidth(0.95f)
                .fillMaxHeight(0.92f)
                .clip(RoundedCornerShape(20.dp)),
            color = MaterialTheme.colorScheme.surface,
            tonalElevation = 6.dp
        ) {
            Column(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(16.dp),
                verticalArrangement = Arrangement.spacedBy(10.dp)
            ) {
                // Header
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.SpaceBetween
                ) {
                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(8.dp),
                        modifier = Modifier.weight(1f)
                    ) {
                        Surface(
                            shape = RoundedCornerShape(10.dp),
                            color = MaterialTheme.colorScheme.primaryContainer,
                            modifier = Modifier.size(36.dp)
                        ) {
                            Box(contentAlignment = Alignment.Center) {
                                Icon(
                                    Icons.Default.LocationOn,
                                    contentDescription = null,
                                    tint = MaterialTheme.colorScheme.primary,
                                    modifier = Modifier.size(22.dp)
                                )
                            }
                        }
                        Column {
                            Text(
                                "Interactive Map Location Picker",
                                fontWeight = FontWeight.Bold,
                                fontSize = 15.sp,
                                maxLines = 1
                            )
                            Text(
                                "Tap anywhere on map or drag to pin exact location",
                                fontSize = 11.sp,
                                color = MaterialTheme.colorScheme.onSurfaceVariant,
                                maxLines = 1
                            )
                        }
                    }
                    IconButton(onClick = onDismiss) {
                        Icon(Icons.Default.Close, contentDescription = "Close")
                    }
                }

                // Address input field
                OutlinedTextField(
                    value = addressText,
                    onValueChange = { addressText = it },
                    label = { Text("Clinic Address / Landmark Name") },
                    leadingIcon = { Icon(Icons.Default.Place, contentDescription = null) },
                    singleLine = true,
                    modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(12.dp)
                )

                // Quick Nepal Cities Pills & GPS
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .horizontalScroll(rememberScrollState()),
                    horizontalArrangement = Arrangement.spacedBy(6.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    FilledTonalButton(
                        onClick = { fetchCurrentGpsLocation() },
                        shape = RoundedCornerShape(8.dp),
                        contentPadding = PaddingValues(horizontal = 12.dp, vertical = 6.dp),
                        modifier = Modifier.defaultMinSize(minHeight = 36.dp),
                        enabled = !isFetchingLocation
                    ) {
                        if (isFetchingLocation) {
                            CircularProgressIndicator(modifier = Modifier.size(14.dp), strokeWidth = 2.dp)
                        } else {
                            Icon(Icons.Default.MyLocation, contentDescription = null, modifier = Modifier.size(15.dp))
                        }
                        Spacer(Modifier.width(6.dp))
                        Text(
                            if (isFetchingLocation) "Getting GPS..." else "Current GPS Location",
                            fontSize = 12.sp,
                            fontWeight = FontWeight.Bold,
                            maxLines = 1
                        )
                    }

                    nepalPresets.forEach { (name, lat, lng) ->
                        FilterChip(
                            selected = (name == addressText),
                            onClick = {
                                addressText = name
                                currentLat = lat
                                currentLng = lng
                                webViewRef?.evaluateJavascript(
                                    "if(window.moveToCoords) window.moveToCoords($lat, $lng);",
                                    null
                                )
                            },
                            label = { Text(name, fontSize = 11.sp, maxLines = 1) },
                            leadingIcon = {
                                Icon(Icons.Default.Place, contentDescription = null, modifier = Modifier.size(14.dp))
                            }
                        )
                    }
                }

                // Map Container (100% Self-Contained Slippy Tile Map Engine — zero external JS dependencies)
                Box(
                    modifier = Modifier
                        .fillMaxWidth()
                        .weight(1f)
                        .clip(RoundedCornerShape(14.dp))
                        .border(1.dp, MaterialTheme.colorScheme.outlineVariant, RoundedCornerShape(14.dp))
                ) {
                    AndroidView(
                        factory = { ctx ->
                            WebView(ctx).apply {
                                settings.javaScriptEnabled = true
                                settings.domStorageEnabled = true
                                settings.databaseEnabled = true
                                settings.allowFileAccess = true
                                settings.allowContentAccess = true
                                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
                                    settings.mixedContentMode = WebSettings.MIXED_CONTENT_ALWAYS_ALLOW
                                }
                                settings.cacheMode = WebSettings.LOAD_DEFAULT
                                settings.userAgentString = "Mozilla/5.0 (Linux; Android 13; Mobile) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36"
                                webChromeClient = WebChromeClient()
                                webViewClient = object : WebViewClient() {
                                    override fun onReceivedSslError(view: WebView?, handler: android.webkit.SslErrorHandler?, error: android.net.http.SslError?) {
                                        handler?.proceed()
                                    }
                                }

                                addJavascriptInterface(object {
                                    @JavascriptInterface
                                    fun onMarkerMoved(lat: Double, lng: Double) {
                                        post {
                                            currentLat = lat
                                            currentLng = lng
                                            reverseGeocode(lat, lng)
                                        }
                                    }
                                }, "AndroidInterface")

                                val html = """
                                    <!DOCTYPE html>
                                    <html>
                                    <head>
                                      <meta charset="utf-8" />
                                      <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
                                      <meta name="referrer" content="no-referrer" />
                                      <style>
                                        * { box-sizing: border-box; user-select: none; -webkit-user-select: none; }
                                        html, body {
                                          margin: 0; padding: 0; width: 100%; height: 100%;
                                          overflow: hidden; background: #e8f0f8;
                                          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                                          touch-action: none;
                                        }
                                        #mapViewport {
                                          position: relative; width: 100%; height: 100%;
                                          overflow: hidden; cursor: grab;
                                          background: linear-gradient(180deg, #e2eef8 0%, #d8e8f4 100%);
                                        }
                                        #gridCanvas {
                                          position: absolute; top: 0; left: 0; width: 100%; height: 100%;
                                          pointer-events: none; z-index: 1;
                                        }
                                        #tileLayer {
                                          position: absolute; top: 0; left: 0; width: 100%; height: 100%;
                                          z-index: 2; pointer-events: none;
                                        }
                                        .map-tile {
                                          position: absolute; width: 256px; height: 256px;
                                          border: none; pointer-events: none;
                                          transition: opacity 0.15s ease;
                                        }
                                        #pinOverlay {
                                          position: absolute; z-index: 10; pointer-events: none;
                                          transform: translate(-50%, -100%);
                                          filter: drop-shadow(0 4px 6px rgba(0,0,0,0.35));
                                        }
                                        .zoom-controls {
                                          position: absolute; right: 12px; bottom: 16px; z-index: 20;
                                          display: flex; flex-direction: column; gap: 6px;
                                        }
                                        .zoom-btn {
                                          width: 38px; height: 38px; border-radius: 10px;
                                          background: rgba(255,255,255,0.95); border: 1px solid #cbd5e1;
                                          box-shadow: 0 2px 6px rgba(0,0,0,0.15);
                                          font-size: 20px; font-weight: bold; color: #0f172a;
                                          display: flex; align-items: center; justify-content: center;
                                          cursor: pointer;
                                        }
                                        .zoom-btn:active { background: #e2e8f0; }
                                      </style>
                                    </head>
                                    <body>
                                      <div id="mapViewport">
                                        <canvas id="gridCanvas"></canvas>
                                        <div id="tileLayer"></div>
                                        <div id="pinOverlay">
                                          <svg width="38" height="48" viewBox="0 0 34 44" fill="none" xmlns="http://www.w3.org/2000/svg">
                                            <path d="M17 0C7.61 0 0 7.61 0 17c0 13.5 17 27 17 27s17-13.5 17-27C34 7.61 26.39 0 17 0z" fill="#0284C7"/>
                                            <circle cx="17" cy="17" r="7.5" fill="#FFFFFF"/>
                                            <circle cx="17" cy="17" r="3.5" fill="#0284C7"/>
                                          </svg>
                                        </div>
                                        <div class="zoom-controls">
                                          <button class="zoom-btn" id="btnZoomIn">+</button>
                                          <button class="zoom-btn" id="btnZoomOut">−</button>
                                        </div>
                                      </div>
                                      <script>
                                        (function() {
                                          var viewport = document.getElementById('mapViewport');
                                          var tileLayer = document.getElementById('tileLayer');
                                          var pinOverlay = document.getElementById('pinOverlay');
                                          var gridCanvas = document.getElementById('gridCanvas');
                                          var ctx = gridCanvas.getContext('2d');

                                          var zoom = 15;
                                          var centerLat = $currentLat;
                                          var centerLng = $currentLng;
                                          var pinLat = $currentLat;
                                          var pinLng = $currentLng;

                                          var tileCache = {};

                                          function lng2tileX(lng, z) {
                                            return ((lng + 180) / 360) * Math.pow(2, z);
                                          }
                                          function lat2tileY(lat, z) {
                                            var rad = lat * Math.PI / 180;
                                            return (1 - Math.log(Math.tan(rad) + 1 / Math.cos(rad)) / Math.PI) / 2 * Math.pow(2, z);
                                          }
                                          function tileX2lng(x, z) {
                                            return x / Math.pow(2, z) * 360 - 180;
                                          }
                                          function tileY2lat(y, z) {
                                            var n = Math.PI - 2 * Math.PI * y / Math.pow(2, z);
                                            return 180 / Math.PI * Math.atan(0.5 * (Math.exp(n) - Math.exp(-n)));
                                          }

                                          function getTileUrls(z, x, y) {
                                            var maxTile = Math.pow(2, z);
                                            var wrappedX = ((x % maxTile) + maxTile) % maxTile;
                                            var sub = ['a', 'b', 'c', 'd'][Math.abs(wrappedX + y) % 4];
                                            return [
                                              'https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/' + z + '/' + y + '/' + wrappedX,
                                              'https://' + sub + '.basemaps.cartocdn.com/rastertiles/voyager/' + z + '/' + wrappedX + '/' + y + '.png',
                                              'https://tile.openstreetmap.fr/hot/' + z + '/' + wrappedX + '/' + y + '.png',
                                              'https://' + sub + '.basemaps.cartocdn.com/light_all/' + z + '/' + wrappedX + '/' + y + '.png',
                                              'https://tile.openstreetmap.org/' + z + '/' + wrappedX + '/' + y + '.png'
                                            ];
                                          }

                                          function drawFallbackGrid(w, h, cx, cy) {
                                            if (gridCanvas.width !== w || gridCanvas.height !== h) {
                                              gridCanvas.width = w;
                                              gridCanvas.height = h;
                                            }
                                            ctx.clearRect(0, 0, w, h);
                                            ctx.strokeStyle = 'rgba(148, 163, 184, 0.35)';
                                            ctx.lineWidth = 1;
                                            var step = 64;
                                            var offX = (-(cx * 256) % step + step) % step;
                                            var offY = (-(cy * 256) % step + step) % step;
                                            for (var x = offX; x < w; x += step) {
                                              ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke();
                                            }
                                            for (var y = offY; y < h; y += step) {
                                              ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke();
                                            }
                                          }

                                          function render() {
                                            var w = viewport.clientWidth || window.innerWidth || 320;
                                            var h = viewport.clientHeight || window.innerHeight || 320;
                                            var cx = lng2tileX(centerLng, zoom);
                                            var cy = lat2tileY(centerLat, zoom);

                                            drawFallbackGrid(w, h, cx, cy);

                                            var startX = Math.floor(cx - (w / 2) / 256) - 1;
                                            var endX = Math.ceil(cx + (w / 2) / 256) + 1;
                                            var startY = Math.floor(cy - (h / 2) / 256) - 1;
                                            var endY = Math.ceil(cy + (h / 2) / 256) + 1;
                                            var maxTile = Math.pow(2, zoom);

                                            var activeKeys = {};
                                            for (var tx = startX; tx <= endX; tx++) {
                                              for (var ty = startY; ty <= endY; ty++) {
                                                if (ty < 0 || ty >= maxTile) continue;
                                                var key = zoom + '_' + tx + '_' + ty;
                                                activeKeys[key] = true;
                                                var img = tileCache[key];
                                                if (!img) {
                                                  img = document.createElement('img');
                                                  img.className = 'map-tile';
                                                  img.alt = '';
                                                  img.referrerPolicy = 'no-referrer';
                                                  img.crossOrigin = 'anonymous';
                                                  var urls = getTileUrls(zoom, tx, ty);
                                                  var urlIdx = 0;
                                                  img.onerror = function() {
                                                    urlIdx++;
                                                    if (urlIdx < urls.length) {
                                                      this.src = urls[urlIdx];
                                                    } else {
                                                      this.style.opacity = '0';
                                                    }
                                                  };
                                                  img.onload = function() {
                                                    this.style.opacity = '1';
                                                  };
                                                  img.src = urls[0];
                                                  tileLayer.appendChild(img);
                                                  tileCache[key] = img;
                                                }
                                                var px = Math.round((w / 2) + (tx - cx) * 256);
                                                var py = Math.round((h / 2) + (ty - cy) * 256);
                                                img.style.left = px + 'px';
                                                img.style.top = py + 'px';
                                              }
                                            }

                                            for (var k in tileCache) {
                                              if (!activeKeys[k]) {
                                                var oldImg = tileCache[k];
                                                if (oldImg && oldImg.parentNode) {
                                                  oldImg.parentNode.removeChild(oldImg);
                                                }
                                                delete tileCache[k];
                                              }
                                            }

                                            // Position marker pin
                                            var pinTileX = lng2tileX(pinLng, zoom);
                                            var pinTileY = lat2tileY(pinLat, zoom);
                                            var pinPx = (w / 2) + (pinTileX - cx) * 256;
                                            var pinPy = (h / 2) + (pinTileY - cy) * 256;
                                            pinOverlay.style.left = pinPx + 'px';
                                            pinOverlay.style.top = pinPy + 'px';
                                          }

                                          function notifyAndroid(lat, lng) {
                                            if (window.AndroidInterface && window.AndroidInterface.onMarkerMoved) {
                                              window.AndroidInterface.onMarkerMoved(lat, lng);
                                            }
                                          }

                                          // Pointer / Touch Drag & Tap Handling
                                          var isDragging = false;
                                          var startX = 0, startY = 0;
                                          var lastX = 0, lastY = 0;
                                          var movedDist = 0;

                                          function onStart(clientX, clientY) {
                                            isDragging = true;
                                            startX = lastX = clientX;
                                            startY = lastY = clientY;
                                            movedDist = 0;
                                          }

                                          function onMove(clientX, clientY) {
                                            if (!isDragging) return;
                                            var dx = clientX - lastX;
                                            var dy = clientY - lastY;
                                            lastX = clientX;
                                            lastY = clientY;
                                            movedDist += Math.abs(dx) + Math.abs(dy);

                                            var cx = lng2tileX(centerLng, zoom) - (dx / 256);
                                            var cy = lat2tileY(centerLat, zoom) - (dy / 256);
                                            centerLng = tileX2lng(cx, zoom);
                                            centerLat = Math.max(-85, Math.min(85, tileY2lat(cy, zoom)));
                                            render();
                                          }

                                          function onEnd(clientX, clientY) {
                                            if (!isDragging) return;
                                            isDragging = false;
                                            if (movedDist < 10) {
                                              var rect = viewport.getBoundingClientRect();
                                              var clickX = clientX - rect.left;
                                              var clickY = clientY - rect.top;
                                              var w = viewport.clientWidth || 320;
                                              var h = viewport.clientHeight || 320;
                                              var cx = lng2tileX(centerLng, zoom);
                                              var cy = lat2tileY(centerLat, zoom);
                                              var targetTileX = cx + (clickX - w / 2) / 256;
                                              var targetTileY = cy + (clickY - h / 2) / 256;
                                              pinLng = tileX2lng(targetTileX, zoom);
                                              pinLat = Math.max(-85, Math.min(85, tileY2lat(targetTileY, zoom)));
                                              render();
                                              notifyAndroid(pinLat, pinLng);
                                            }
                                          }

                                          viewport.addEventListener('mousedown', function(e) {
                                            if (e.target.tagName === 'BUTTON') return;
                                            onStart(e.clientX, e.clientY);
                                          });
                                          window.addEventListener('mousemove', function(e) {
                                            onMove(e.clientX, e.clientY);
                                          });
                                          window.addEventListener('mouseup', function(e) {
                                            onEnd(e.clientX, e.clientY);
                                          });

                                          var pinchDist = 0;
                                          var lastTap = 0;
                                          viewport.addEventListener('touchstart', function(e) {
                                            if (e.target.tagName === 'BUTTON') return;
                                            if (e.touches.length === 1) {
                                              pinchDist = 0;
                                              onStart(e.touches[0].clientX, e.touches[0].clientY);
                                            } else if (e.touches.length === 2) {
                                              isDragging = false;
                                              var dx = e.touches[0].clientX - e.touches[1].clientX;
                                              var dy = e.touches[0].clientY - e.touches[1].clientY;
                                              pinchDist = Math.sqrt(dx * dx + dy * dy);
                                            }
                                          }, { passive: true });
                                          viewport.addEventListener('touchmove', function(e) {
                                            if (e.touches.length === 1 && !pinchDist) {
                                              onMove(e.touches[0].clientX, e.touches[0].clientY);
                                            } else if (e.touches.length === 2) {
                                              var dx = e.touches[0].clientX - e.touches[1].clientX;
                                              var dy = e.touches[0].clientY - e.touches[1].clientY;
                                              var d = Math.sqrt(dx * dx + dy * dy);
                                              if (pinchDist > 0) {
                                                if (d - pinchDist > 40 && zoom < 19) {
                                                  zoom++;
                                                  pinchDist = d;
                                                  render();
                                                } else if (pinchDist - d > 40 && zoom > 4) {
                                                  zoom--;
                                                  pinchDist = d;
                                                  render();
                                                }
                                              } else {
                                                pinchDist = d;
                                              }
                                            }
                                          }, { passive: true });
                                          viewport.addEventListener('touchend', function(e) {
                                            pinchDist = 0;
                                            var now = Date.now();
                                            if (now - lastTap < 300 && zoom < 19) {
                                              zoom++;
                                              render();
                                            }
                                            lastTap = now;
                                            var t = (e.changedTouches && e.changedTouches[0]) ? e.changedTouches[0] : { clientX: lastX, clientY: lastY };
                                            onEnd(t.clientX, t.clientY);
                                          }, { passive: true });

                                          document.getElementById('btnZoomIn').addEventListener('click', function(e) {
                                            e.stopPropagation();
                                            if (zoom < 19) { zoom++; render(); }
                                          });
                                          document.getElementById('btnZoomOut').addEventListener('click', function(e) {
                                            e.stopPropagation();
                                            if (zoom > 4) { zoom--; render(); }
                                          });

                                          window.moveToCoords = function(lat, lng) {
                                            centerLat = lat;
                                            centerLng = lng;
                                            pinLat = lat;
                                            pinLng = lng;
                                            render();
                                            notifyAndroid(lat, lng);
                                          };

                                          window.addEventListener('resize', render);
                                          setTimeout(render, 50);
                                          setTimeout(render, 250);
                                          setTimeout(render, 600);
                                          setTimeout(render, 1200);
                                          render();
                                        })();
                                      </script>
                                    </body>
                                    </html>
                                """.trimIndent()

                                loadDataWithBaseURL("https://www.openstreetmap.org", html, "text/html", "UTF-8", null)
                                webViewRef = this
                            }
                        },
                        modifier = Modifier.fillMaxSize()
                    )

                    // Pin instruction overlay badge
                    Surface(
                        shape = RoundedCornerShape(8.dp),
                        color = MaterialTheme.colorScheme.surface.copy(alpha = 0.92f),
                        tonalElevation = 4.dp,
                        modifier = Modifier
                            .align(Alignment.TopCenter)
                            .padding(8.dp)
                    ) {
                        Text(
                            text = "📍 Tap anywhere on map to place pin or drag to pan",
                            fontSize = 11.sp,
                            fontWeight = FontWeight.SemiBold,
                            color = MaterialTheme.colorScheme.onSurface,
                            modifier = Modifier.padding(horizontal = 10.dp, vertical = 4.dp)
                        )
                    }
                }

                // Coordinates info bar
                Surface(
                    shape = RoundedCornerShape(10.dp),
                    color = MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.6f),
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Row(
                        modifier = Modifier.padding(horizontal = 12.dp, vertical = 8.dp),
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.SpaceBetween
                    ) {
                        Column {
                            Text(
                                "Selected Coordinates",
                                fontSize = 10.sp,
                                fontWeight = FontWeight.Bold,
                                color = MaterialTheme.colorScheme.primary
                            )
                            Text(
                                "${String.format(Locale.US, "%.5f", currentLat)}° N, ${String.format(Locale.US, "%.5f", currentLng)}° E",
                                fontSize = 12.sp,
                                fontWeight = FontWeight.SemiBold
                            )
                        }
                        Text(
                            "Live GPS Map Verified",
                            fontSize = 10.sp,
                            color = MaterialTheme.colorScheme.onSurfaceVariant
                        )
                    }
                }

                // Action Buttons: Save & Cancel
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    OutlinedButton(
                        onClick = onDismiss,
                        modifier = Modifier
                            .weight(1f)
                            .defaultMinSize(minHeight = 44.dp),
                        shape = RoundedCornerShape(12.dp),
                        contentPadding = PaddingValues(horizontal = 8.dp, vertical = 8.dp)
                    ) {
                        Text("Cancel", fontSize = 13.sp, fontWeight = FontWeight.SemiBold)
                    }

                    Button(
                        onClick = {
                            val finalAddress = addressText.ifBlank {
                                "Clinic Location (${String.format(Locale.US, "%.4f", currentLat)}, ${String.format(Locale.US, "%.4f", currentLng)})"
                            }
                            onSaveLocation(finalAddress, currentLat, currentLng)
                        },
                        modifier = Modifier
                            .weight(1.4f)
                            .defaultMinSize(minHeight = 44.dp),
                        shape = RoundedCornerShape(12.dp),
                        contentPadding = PaddingValues(horizontal = 10.dp, vertical = 8.dp)
                    ) {
                        Icon(Icons.Default.Check, contentDescription = null, modifier = Modifier.size(16.dp))
                        Spacer(Modifier.width(6.dp))
                        Text("Confirm Location", fontSize = 13.sp, fontWeight = FontWeight.Bold, maxLines = 1)
                    }
                }
            }
        }
    }

    if (showEnableGpsDialog) {
        AlertDialog(
            onDismissRequest = { showEnableGpsDialog = false },
            icon = { Icon(Icons.Default.MyLocation, contentDescription = null, tint = MaterialTheme.colorScheme.primary) },
            title = { Text("Turn On Location Services", fontWeight = FontWeight.Bold) },
            text = {
                Text(
                    "Your phone's GPS / Location Services are turned off. Please enable Location Services so Dactor can detect your exact location on the map.",
                    fontSize = 13.sp
                )
            },
            confirmButton = {
                Button(onClick = {
                    showEnableGpsDialog = false
                    try {
                        gpsSettingsLauncher.launch(Intent(Settings.ACTION_LOCATION_SOURCE_SETTINGS))
                    } catch (e: Exception) {
                        context.startActivity(Intent(Settings.ACTION_LOCATION_SOURCE_SETTINGS))
                    }
                }) {
                    Text("Turn On Location")
                }
            },
            dismissButton = {
                TextButton(onClick = { showEnableGpsDialog = false }) {
                    Text("Cancel")
                }
            }
        )
    }

    if (showPermissionSettingsDialog) {
        AlertDialog(
            onDismissRequest = { showPermissionSettingsDialog = false },
            icon = { Icon(Icons.Default.LocationOn, contentDescription = null, tint = MaterialTheme.colorScheme.primary) },
            title = { Text("Location Permission Needed", fontWeight = FontWeight.Bold) },
            text = {
                Text(
                    "Location permission is required to automatically find your current position on the map. Please allow Location permission.",
                    fontSize = 13.sp
                )
            },
            confirmButton = {
                Button(onClick = {
                    showPermissionSettingsDialog = false
                    try {
                        val intent = Intent(
                            Settings.ACTION_APPLICATION_DETAILS_SETTINGS,
                            Uri.fromParts("package", context.packageName, null)
                        )
                        context.startActivity(intent)
                    } catch (ignored: Exception) {}
                }) {
                    Text("Open Settings")
                }
            },
            dismissButton = {
                TextButton(onClick = {
                    showPermissionSettingsDialog = false
                    locationPermLauncher.launch(
                        arrayOf(Manifest.permission.ACCESS_FINE_LOCATION, Manifest.permission.ACCESS_COARSE_LOCATION)
                    )
                }) {
                    Text("Ask Again")
                }
            }
        )
    }
}
