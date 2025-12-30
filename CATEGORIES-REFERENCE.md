# Attire Categories Reference

This document contains all available attire categories in the HOG platform with their IDs for API usage.

## 🎯 How to Use

When creating materials via the API, use these category IDs in your requests:

```
POST /api/v1/material/createMaterial/{categoryId}
```

---

## 📋 Available Categories

### Nigerian Traditional Wear

| ID | Category Name | Description |
|---|---|---|
| `6953e397191dd43782210e6b` | **Agbada** | Traditional Nigerian flowing gown for men with rich fabrics and embroidery |
| `6953e397191dd43782210e6c` | **Kaftan** | Elegant flowing robe for both men and women |
| `6953e397191dd43782210e6d` | **Ankara Styles** | Vibrant African print dresses, skirts, tops, and jumpsuits |
| `6953e397191dd43782210e6e` | **Buba and Sokoto** | Traditional Yoruba men's outfit (loose top + trousers) |
| `6953e397191dd43782210e6f` | **Iro and Buba** | Traditional Yoruba women's attire (wrapper + blouse + head tie) |
| `6953e397191dd43782210e70` | **George Wrapper** | Luxurious wrapper fabric with sequins or embroidery |
| `6953e397191dd43782210e71` | **Senator Wear** | Modern Nigerian men's formal wear |
| `6953e397191dd43782210e72` | **Dashiki** | Colorful garment with intricate embroidery around neckline |
| `6953e397191dd43782210e73` | **Aso Oke** | Hand-woven cloth from Yoruba land for special occasions |
| `6953e397191dd43782210e74` | **Native Gown** | Traditional Nigerian gown for women |

### Modern/Western Styles

| ID | Category Name | Description |
|---|---|---|
| `6953e397191dd43782210e75` | **Corporate Suit** | Professional business attire (blazers, trousers, shirts) |
| `6953e397191dd43782210e76` | **Casual Wear** | Everyday comfortable clothing (t-shirts, jeans, shorts) |
| `6953e397191dd43782210e77` | **Evening Gown** | Elegant formal dresses for special evening events |
| `6953e397191dd43782210e78` | **Wedding Dress** | Bridal gowns and wedding attire |
| `6953e397191dd43782210e79` | **Party Dress** | Trendy dresses for parties and celebrations |
| `6953e397191dd43782210e7a` | **Jumpsuit** | One-piece garment combining top and trousers |
| `6953e397191dd43782210e7b` | **Skirt and Blouse** | Classic combination for office and semi-formal events |
| `6953e397191dd43782210e7c` | **Trouser and Shirt** | Professional combination for office wear |

### Fusion/Contemporary

| ID | Category Name | Description |
|---|---|---|
| `6953e397191dd43782210e7d` | **Ankara Fusion** | Modern designs combining African prints with Western styles |
| `6953e397191dd43782210e7e` | **Smart Casual** | Blend of formal and casual wear for semi-formal events |

### Children's Wear

| ID | Category Name | Description |
|---|---|---|
| `6953e397191dd43782210e7f` | **Children's Traditional** | Traditional Nigerian attire for children |
| `6953e397191dd43782210e80` | **Children's Casual** | Comfortable everyday wear for children |

### Religious/Cultural

| ID | Category Name | Description |
|---|---|---|
| `6953e397191dd43782210e81` | **Muslim Wear** | Modest Islamic clothing (Hijabs, Abayas, Jalabiyas) |
| `6953e397191dd43782210e82` | **Choir Robe** | Church and choir robes for religious ceremonies |

### Accessories

| ID | Category Name | Description |
|---|---|---|
| `6953e397191dd43782210e83` | **Traditional Accessories** | Nigerian accessories (caps, beads, coral beads, walking sticks) |

---

## 🚀 API Usage Examples

### Get All Categories
```bash
GET https://hogbackend.vercel.app/api/v1/category/getAllCategories
```

### Create Material with Category (Agbada)
```bash
POST https://hogbackend.vercel.app/api/v1/material/createMaterial/6953e397191dd43782210e6b

Body:
{
  "clothMaterial": "Silk",
  "color": "White",
  "brand": "Gucci",
  "measurement": [...],
  "specialInstructions": "..."
}
```

### Create Material with Category (Ankara Styles)
```bash
POST https://hogbackend.vercel.app/api/v1/material/createMaterial/6953e397191dd43782210e6d

Body:
{
  "clothMaterial": "Cotton Ankara",
  "color": "Multi-color",
  "brand": "Vlisco",
  "measurement": [...],
  "specialInstructions": "..."
}
```

---

## 🔄 Database Management

### Re-seed Categories (Replace All)
```bash
npm run seed:replace
```

### Add More Categories (Keep Existing)
```bash
npm run seed:add
```

### Skip Seeding (Keep Existing)
```bash
npm run seed:skip
```

---

## 📝 Notes

- All categories are now populated in the database
- Users can select from these categories when creating materials
- The `attireType` field will automatically be set from the category name
- Category IDs remain constant unless you re-seed with `--replace`
- For materials without a category, users can still provide `attireType` manually

---

## ✅ Database Status

**Total Categories:** 25
- Nigerian Traditional: 10 categories
- Modern/Western: 8 categories
- Fusion/Contemporary: 2 categories
- Children's Wear: 2 categories
- Religious/Cultural: 2 categories
- Accessories: 1 category

All categories seeded successfully on: 2025-12-30
