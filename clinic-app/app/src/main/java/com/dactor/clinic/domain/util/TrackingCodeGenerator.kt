package com.dactor.clinic.domain.util

import kotlin.random.Random

object TrackingCodeGenerator {
    fun generate10DigitCode(): String {
        val firstDigit = Random.nextInt(1, 10).toString()
        val rest = (1..9).joinToString("") { Random.nextInt(0, 10).toString() }
        return firstDigit + rest
    }

    fun generate(): String = generate10DigitCode()
}
