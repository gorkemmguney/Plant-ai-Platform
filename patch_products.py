import io

path = "mobile/src/screens/seller/ProductsScreen.tsx"
with io.open(path, "r", encoding="utf-8") as f:
    src = f.read()

replacements = [
    (
        "import { colors, fonts, radius, shadow, spacing } from '../../theme/theme';",
        "import { badgeColors, colors, fonts, radius, shadow, spacing } from '../../theme/theme';\n\nconst LOW_STOCK_THRESHOLD = 5;",
    ),
    (
        "  const [existingImageUrl, setExistingImageUrl] = useState<string | null>(null);\n\n  const loadProducts = useCallback(async () => {",
        "  const [existingImageUrl, setExistingImageUrl] = useState<string | null>(null);\n\n  const lowStockProducts = products.filter((p) => Number(p.stock) < LOW_STOCK_THRESHOLD);\n\n  const loadProducts = useCallback(async () => {",
    ),
    (
        "      <View style={styles.cardBottom}>\n        <Text style={styles.stock}>Stok: {item.stock}</Text>",
        "      <View style={styles.cardBottom}>\n        <Text style={[styles.stock, Number(item.stock) < LOW_STOCK_THRESHOLD && styles.stockLow]}>\n          Stok: {item.stock}\n        </Text>",
    ),
    (
        "        <TouchableOpacity style={styles.addButton} onPress={openCreate} activeOpacity={0.85}>\n          <Text style={styles.addButtonText}>+ Ekle</Text>\n        </TouchableOpacity>\n      </View>\n\n      {loading ? (",
        "        <TouchableOpacity style={styles.addButton} onPress={openCreate} activeOpacity={0.85}>\n          <Text style={styles.addButtonText}>+ Ekle</Text>\n        </TouchableOpacity>\n      </View>\n\n      {lowStockProducts.length > 0 && (\n        <View style={styles.lowStockCard}>\n          <View style={styles.lowStockIconWrap}>\n            <Text style={styles.lowStockIcon}>\u26a0\ufe0f</Text>\n          </View>\n          <View style={{ flex: 1 }}>\n            <Text style={styles.lowStockTitle}>Stok kritik seviyede</Text>\n            <Text style={styles.lowStockSubtitle}>\n              {lowStockProducts.length} \u00fcr\u00fcnde stok 5 adedin alt\u0131na d\u00fc\u015ft\u00fc\n            </Text>\n          </View>\n          <View style={styles.lowStockCountBadge}>\n            <Text style={styles.lowStockCountText}>{lowStockProducts.length}</Text>\n          </View>\n        </View>\n      )}\n\n      {loading ? (",
    ),
    (
        "  stock: { fontFamily: fonts.sansMedium, fontSize: 12.5, color: colors.muted },",
        "  stock: { fontFamily: fonts.sansMedium, fontSize: 12.5, color: colors.muted },\n"
        "  stockLow: { color: colors.red, fontFamily: fonts.sansBold },\n"
        "  lowStockCard: {\n"
        "    flexDirection: 'row',\n"
        "    alignItems: 'center',\n"
        "    gap: spacing.md,\n"
        "    backgroundColor: badgeColors.red.bg,\n"
        "    borderRadius: radius.lg,\n"
        "    borderWidth: 1,\n"
        "    borderColor: 'rgba(194,52,52,0.18)',\n"
        "    marginHorizontal: spacing.lg,\n"
        "    marginBottom: spacing.md,\n"
        "    padding: spacing.md,\n"
        "    ...shadow.sm,\n"
        "  },\n"
        "  lowStockIconWrap: {\n"
        "    width: 38,\n"
        "    height: 38,\n"
        "    borderRadius: radius.full,\n"
        "    backgroundColor: colors.white,\n"
        "    alignItems: 'center',\n"
        "    justifyContent: 'center',\n"
        "  },\n"
        "  lowStockIcon: { fontSize: 17 },\n"
        "  lowStockTitle: { fontFamily: fonts.sansBold, fontSize: 13.5, color: badgeColors.red.text },\n"
        "  lowStockSubtitle: { fontFamily: fonts.sans, fontSize: 12, color: badgeColors.red.text, marginTop: 2, opacity: 0.85 },\n"
        "  lowStockCountBadge: {\n"
        "    minWidth: 26,\n"
        "    height: 26,\n"
        "    borderRadius: radius.full,\n"
        "    backgroundColor: colors.red,\n"
        "    alignItems: 'center',\n"
        "    justifyContent: 'center',\n"
        "    paddingHorizontal: 6,\n"
        "  },\n"
        "  lowStockCountText: { fontFamily: fonts.sansBold, fontSize: 12.5, color: colors.white },",
    ),
]

missing = []
for old, new in replacements:
    if old not in src:
        missing.append(old[:60])
    else:
        src = src.replace(old, new, 1)

if missing:
    print("UYARI: Bu parcalar dosyada bulunamadi, muhtemelen dosya zaten degisik:")
    for m in missing:
        print(" -", m)
else:
    with io.open(path, "w", encoding="utf-8") as f:
        f.write(src)
    print("Basarili: ProductsScreen.tsx guncellendi.")
