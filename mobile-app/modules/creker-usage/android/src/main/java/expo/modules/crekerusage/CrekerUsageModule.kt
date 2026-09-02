package expo.modules.crekerusage

import android.database.Cursor
import android.net.Uri
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

private const val AUTHORITY = "com.creker.screentime.provider"

/**
 * Reads device-wide screen-on time out of creker's (a separate, sibling app on the
 * same device) read-only ContentProvider — see creker's UsageProvider.kt for the
 * query contract this mirrors. Nothing here writes anything or requires network;
 * if creker isn't installed, hasn't granted the permission, or has no data for the
 * range, every call just resolves to an empty list rather than throwing — "no data"
 * is an expected, normal state here, not an error.
 */
class CrekerUsageModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("CrekerUsage")

    // fromDate/toDate: "yyyy-MM-dd", inclusive. Resolves to a list of
    // { date: string, screenMillis: number, updatedAt: number } — one entry per day
    // creker has synced data for; missing days are simply absent from the list.
    // updatedAt is epoch millis up to which screenMillis for that day is complete
    // (not when the row was written), so a caller can tell a measured zero from a
    // day creker simply hasn't caught up on. Older creker builds have no such
    // column; those rows come back with updatedAt = 0, meaning "unknown".
    AsyncFunction("getScreenTime") { fromDate: String, toDate: String ->
      val resolver = appContext.reactContext?.contentResolver
        ?: return@AsyncFunction emptyList<Map<String, Any>>()
      val uri = Uri.parse("content://$AUTHORITY/device_usage")
      val results = mutableListOf<Map<String, Any>>()
      try {
        val cursor: Cursor? = resolver.query(uri, null, null, arrayOf(fromDate, toDate), null)
        cursor?.use {
          val dateIdx = it.getColumnIndex("date")
          val millisIdx = it.getColumnIndex("screen_millis")
          // Absent on creker builds that predate the column — treat every row as
          // "unknown" (0) rather than dropping the data we do have.
          val updatedIdx = it.getColumnIndex("updated_at")
          if (dateIdx >= 0 && millisIdx >= 0) {
            while (it.moveToNext()) {
              results.add(
                mapOf(
                  "date" to it.getString(dateIdx),
                  "screenMillis" to it.getLong(millisIdx),
                  "updatedAt" to if (updatedIdx >= 0) it.getLong(updatedIdx) else 0L,
                )
              )
            }
          }
        }
      } catch (e: Exception) {
        // creker missing / permission not granted / provider unreachable — same as no data.
      }
      results
    }
  }
}
