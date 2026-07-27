import io

path = "mobile/src/screens/seller/ProductsScreen.tsx"
with io.open(path, "r", encoding="utf-8") as f:
    src = f.read()

changed = False

old_jsx = (
    "  return (\n"
    "    <View style={styles.screen}>\n"
    "      {lowStockProducts.length > 0 && (\n"
    "        <View style={styles.lowStockBanner}>\n"
    "          <Text style={styles.lowStockBannerText}>\n"
    "            \u26a0\ufe0f {lowStockProducts.length} \u00fcr\u00fcnde stok kritik seviyede (5'in alt\u0131nda)\n"
    "          </Text>\n"
    "        </View>\n"
    "      )}\n"
    "      <View style={styles.header}>"
)
new_jsx = (
    "  return (\n"
    "    <View style={styles.screen}>\n"
    "      <View style={styles.header}>"
)
if old_jsx in src:
    src = src.replace(old_jsx, new_jsx, 1)
    changed = True

if "styles.lowStockCard" not in src:
    old_after_header = (
        "        <TouchableOpacity style={styles.addButton} onPress={openCreate} activeOpacity={0.85}>\n"
        "          <Text style={styles.addButtonText}>+ Ekle</Text>\n"
        "        </TouchableOpacity>\n"
        "      </View>\n"
        "\n"
        "      {loading ? ("
    )
    new_after_header = (
        "        <TouchableOpacity style={styles.addButton} onPress={openCreate} activeOpacity={0.85}>\n"
        "          <Text style={styles.addButtonText}>+ Ekle</Text>\n"
        "        </TouchableOpacity>\n"
        "      </View>\n"
        "\n"
        "      {lowStockProducts.length > 0 && (\n"
        "        <View style={styles.lowStockCard}>\n"
        "          <View style={styles.lowStockIconWrap}>\n"
        "            <Text style={styles.lowStockIcon}>\u26a0\ufe0f</Text>\n"
        "          </View>\n"
        "          <View style={{ flex: 1 }}>\n"
        "            <Text style={styles.lowStockTitle}>Stok kritik seviyede</Text>\n"
        "            <Text style={styles.lowStockSubtitle}>\n"
        "              {lowStockProducts.length} \u00fcr\u00fcnde stok 5 adedin alt\u0131na d\u00fc\u015ft\u00fc\n"
        "            </Text>\n"
        "          </View>\n"
        "          <View style={styles.lowStockCountBadge}>\n"
        "            <Text style={styles.lowStockCountText}>{lowStockProducts.length}</Text>\n"
        "          </View>\n"
        "        </View>\n"
        "      )}\n"
        "\n"
        "      {loading ? ("
    )
    if old_after_header in src:
        src = src.replace(old_after_header, new_after_header, 1)
        changed = True
    else:
        print("UYARI: header/loading kalibi bulunamadi, JSX eklenemedi.")

old_styles = (
    "  lowStockBanner: {\n"
    "    backgroundColor: badgeColors.red.bg,\n"
    "    paddingTop: 48,\n"
    "    paddingBottom: spacing.sm,\n"
    "    paddingHorizontal: spacing.lg,\n"
    "    borderBottomWidth: 1,\n"
    "    borderBottomColor: colors.red,\n"
    "  },\n"
    "  lowStockBannerText: {\n"
    "    fontFamily: fonts.sansBold,\n"
    "    fontSize: 13,\n"
    "    color: badgeColors.red.text,\n"
    "    textAlign: 'center',\n"
    "  },\n"
)
if old_styles in src:
    src = src.replace(old_styles, "", 1)
    changed = True

if "lowStockCard: {" not in src:
    card_block = (
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
        "  lowStockCountText: { fontFamily: fonts.sansBold, fontSize: 12.5, color: colors.white },\n"
    )
    stockLow_line = "  stockLow: { color: colors.red, fontFamily: fonts.sansBold },\n"
    stock_line = "  stock: { fontFamily: fonts.sansMedium, fontSize: 12.5, color: colors.muted },\n"

    if stockLow_line in src:
        src = src.replace(stockLow_line, stockLow_line + card_block, 1)
        changed = True
    elif stock_line in src:
        src = src.replace(stock_line, stock_line + stockLow_line + card_block, 1)
        changed = True

with io.open(path, "w", encoding="utf-8") as f:
    f.write(src)

print("Bitti. Degisiklik yapildi mi:", changed)
