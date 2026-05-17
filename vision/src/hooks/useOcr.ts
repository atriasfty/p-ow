import { useState, useCallback, useRef } from 'react'

export function useOcr() {
    const [isProcessing, setIsProcessing] = useState(false)
    const processingRef = useRef(false)

    const processCapture = useCallback(async (imageDataUrl: string, _knownPlayers?: Set<string>): Promise<string | null> => {
        // Prevent concurrent captures
        if (processingRef.current) {
            console.log('Capture already in progress, skipping...')
            return null
        }

        setIsProcessing(true)
        processingRef.current = true

        try {
            // Validate the data URL format
            if (!imageDataUrl || typeof imageDataUrl !== 'string' || !imageDataUrl.startsWith('data:image')) {
                console.error('Invalid image data')
                return null
            }

            // Resize and compress image to avoid 413 Payload Too Large errors
            // High-DPI screens can generate >3MB PNGs, exceeding Next.js defaults (1MB)
            const optimizeImage = (url: string): Promise<string> => {
                return new Promise((resolve, reject) => {
                    const img = new Image()
                    img.onload = () => {
                        const canvas = document.createElement('canvas')
                        const ctx = canvas.getContext('2d')
                        if (!ctx) {
                            reject('No canvas context')
                            return
                        }

                        // Target dimensions: Max 800px width (sufficient for OCR)
                        // This handles Retina 2x/3x captures by downscaling them back to standard resolution
                        const MAX_WIDTH = 800
                        let width = img.width
                        let height = img.height

                        if (width > MAX_WIDTH) {
                            height = Math.round(height * (MAX_WIDTH / width))
                            width = MAX_WIDTH
                        }

                        canvas.width = width
                        canvas.height = height

                        ctx.drawImage(img, 0, 0, width, height)

                        // Convert to JPEG with 0.8 quality for significant size reduction
                        // PNG is lossless but huge for raw screenshots
                        resolve(canvas.toDataURL('image/jpeg', 0.8))
                    }
                    img.onerror = (e) => reject(e)
                    img.src = url
                })
            }

            const optimizedImage = await optimizeImage(imageDataUrl)

            // Get auth token and signature
            const token = await window.electronAPI.getAuthToken()
            if (!token) {
                console.error('No auth token available')
                return null
            }

            // Use environment variable or fallback to production
            const API_BASE = (import.meta as any).env?.VITE_API_BASE_URL || 'https://pow.ciankelly.xyz'

            const identifyBody = JSON.stringify({ image: optimizedImage })

            const signature = await window.electronAPI.generateSignature({
                method: 'POST',
                path: '/api/vision/identify',
                body: identifyBody
            })

            // Call the Vision API with timeout
            const controller = new AbortController()
            const timeoutId = setTimeout(() => controller.abort(), 10000) // 10s timeout

            const response = await fetch(`${API_BASE}/api/vision/identify`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`,
                    'X-Vision-Sig': signature
                },
                body: identifyBody,
                signal: controller.signal
            })

            clearTimeout(timeoutId)

            if (!response.ok) {
                if (response.status === 401) {
                    throw new Error('Unauthorized')
                }
                const errText = await response.text()
                console.error('Vision API error:', response.status, errText)
                throw new Error('API Error')
            }

            const data = await response.json()
            if (data.username) {
                // Sanitize output: Remove any non-alphanumeric characters (except underscore)
                // Pixtral sometimes adds trailing punctuation like "Username."
                const cleanName = data.username.replace(/[^a-zA-Z0-9_]/g, '')

                // Validate Roblox username rules (3-20 chars)
                if (cleanName.length >= 3 && cleanName.length <= 20) {
                    console.log('UseOCR: AI identified user:', cleanName)
                    return cleanName
                }

                console.warn('UseOCR: AI returned invalid username format:', data.username, '->', cleanName)
            }

            console.log('UseOCR: No user identified by AI')
            return null

        } catch (error) {
            console.error('OCR process error:', error)
            return null
        } finally {
            setIsProcessing(false)
            processingRef.current = false
        }
    }, [])

    return { processCapture, isProcessing }
}

