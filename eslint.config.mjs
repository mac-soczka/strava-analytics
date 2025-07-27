import { FlatCompat } from '@eslint/eslintrc'
import path from 'path'
import { fileURLToPath } from 'url'
import js from '@eslint/js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const compat = new FlatCompat({
  baseDirectory: __dirname,
  recommendedConfig: { ...js.configs.recommended }
})

export default [
  ...compat.extends('next/core-web-vitals'),
  {
    rules: {
      // Temporarily disable problematic rules
      'no-unused-vars': 'warn'
    }
  }
]
