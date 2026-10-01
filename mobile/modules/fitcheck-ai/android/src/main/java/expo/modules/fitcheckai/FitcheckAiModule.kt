package expo.modules.fitcheckai

import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.net.Uri
import com.google.mlkit.genai.common.DownloadStatus
import com.google.mlkit.genai.common.FeatureStatus
import com.google.mlkit.genai.prompt.Generation
import com.google.mlkit.genai.prompt.GenerativeModel
import com.google.mlkit.genai.prompt.ImagePart
import com.google.mlkit.genai.prompt.TextPart
import com.google.mlkit.genai.prompt.generateContentRequest
import expo.modules.kotlin.exception.CodedException
import expo.modules.kotlin.functions.Coroutine
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import expo.modules.kotlin.records.Field
import expo.modules.kotlin.records.Record
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext

class GenerateOptions : Record {
  @Field val temperature: Double? = null
  @Field val topK: Int? = null
  @Field val maxOutputTokens: Int? = null
}

// Wraps Google's on-device Gemini Nano (ML Kit GenAI Prompt API).
// Nothing here sends data off the phone.
class FitcheckAiModule : Module() {
  private var model: GenerativeModel? = null

  private fun client(): GenerativeModel = model ?: Generation.getClient().also { model = it }

  private val context
    get() = appContext.reactContext ?: throw CodedException("NO_CONTEXT", "App context unavailable", null)

  override fun definition() = ModuleDefinition {
    Name("FitcheckAi")

    Events("onDownloadProgress")

    AsyncFunction("getStatus") Coroutine { ->
      try {
        when (client().checkStatus()) {
          FeatureStatus.AVAILABLE -> "available"
          FeatureStatus.DOWNLOADABLE -> "downloadable"
          FeatureStatus.DOWNLOADING -> "downloading"
          else -> "unavailable"
        }
      } catch (e: Throwable) {
        // No AICore / unsupported device / unlocked bootloader.
        "unavailable"
      }
    }

    AsyncFunction("download") Coroutine { ->
      var completed = false
      client().download().collect { status ->
        when (status) {
          is DownloadStatus.DownloadProgress ->
            sendEvent("onDownloadProgress", mapOf("bytesDownloaded" to status.totalBytesDownloaded.toDouble()))
          is DownloadStatus.DownloadFailed ->
            throw CodedException("DOWNLOAD_FAILED", status.e.message ?: "Download failed", status.e)
          DownloadStatus.DownloadCompleted -> completed = true
          else -> {}
        }
      }
      completed
    }

    AsyncFunction("generate") Coroutine { prompt: String, imageUri: String?, options: GenerateOptions ->
      val bitmap = imageUri?.let { withContext(Dispatchers.IO) { loadBitmap(it, 768) } }
      val request =
        if (bitmap != null) {
          generateContentRequest(ImagePart(bitmap), TextPart(prompt)) {
            options.temperature?.let { temperature = it.toFloat() }
            options.topK?.let { topK = it }
            options.maxOutputTokens?.let { maxOutputTokens = it }
          }
        } else {
          generateContentRequest(TextPart(prompt)) {
            options.temperature?.let { temperature = it.toFloat() }
            options.topK?.let { topK = it }
            options.maxOutputTokens?.let { maxOutputTokens = it }
          }
        }
      try {
        val response = client().generateContent(request)
        response.candidates.firstOrNull()?.text ?: ""
      } catch (e: Throwable) {
        throw CodedException("GENERATION_FAILED", e.message ?: "The on-device AI couldn't respond", e)
      }
    }

    // Two most common colours in the centre of a photo, as #rrggbb.
    AsyncFunction("dominantColors") Coroutine { imageUri: String ->
      withContext(Dispatchers.Default) {
        val source = withContext(Dispatchers.IO) { loadBitmap(imageUri, 256) }
        val bmp = Bitmap.createScaledBitmap(source, 60, 80, true)
        val buckets = HashMap<Int, LongArray>()
        for (x in 12 until 48) {
          for (y in 16 until 64) {
            val p = bmp.getPixel(x, y)
            if ((p ushr 24) < 128) continue
            val r = (p shr 16) and 0xff
            val g = (p shr 8) and 0xff
            val b = p and 0xff
            val key = ((r / 32) shl 6) or ((g / 32) shl 3) or (b / 32)
            val acc = buckets.getOrPut(key) { LongArray(4) }
            acc[0]++
            acc[1] += r.toLong()
            acc[2] += g.toLong()
            acc[3] += b.toLong()
          }
        }
        buckets.values
          .sortedByDescending { it[0] }
          .take(2)
          .map { acc ->
            val n = acc[0].coerceAtLeast(1)
            String.format("#%02x%02x%02x", acc[1] / n, acc[2] / n, acc[3] / n)
          }
      }
    }

    OnDestroy {
      model?.close()
      model = null
    }
  }

  private fun loadBitmap(uriString: String, maxDim: Int): Bitmap {
    val uri = Uri.parse(uriString)
    val resolver = context.contentResolver
    val bounds = BitmapFactory.Options().apply { inJustDecodeBounds = true }
    resolver.openInputStream(uri)?.use { BitmapFactory.decodeStream(it, null, bounds) }
    var sample = 1
    while (bounds.outWidth / (sample * 2) >= maxDim && bounds.outHeight / (sample * 2) >= maxDim) sample *= 2
    val opts = BitmapFactory.Options().apply { inSampleSize = sample }
    return resolver.openInputStream(uri)?.use { BitmapFactory.decodeStream(it, null, opts) }
      ?: throw CodedException("BAD_IMAGE", "Couldn't read the photo", null)
  }
}
