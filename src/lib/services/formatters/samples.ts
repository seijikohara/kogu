/**
 * Formatters - Sample Data
 */

export const SAMPLE_JSON = `{
  "name": "John Doe",
  "age": 30,
  "email": "john.doe@example.com",
  "address": {
    "street": "123 Main St",
    "city": "New York",
    "country": "USA"
  },
  "hobbies": ["reading", "gaming", "hiking"],
  "active": true,
  "balance": 1234.56
}`;

export const SAMPLE_YAML = `name: John Doe
age: 30
email: john.doe@example.com
address:
  street: 123 Main St
  city: New York
  country: USA
hobbies:
  - reading
  - gaming
  - hiking
active: true
balance: 1234.56`;

export const SAMPLE_XML = `<?xml version="1.0" encoding="UTF-8"?>
<person>
  <name>John Doe</name>
  <age>30</age>
  <email>john.doe@example.com</email>
  <address>
    <street>123 Main St</street>
    <city>New York</city>
    <country>USA</country>
  </address>
  <hobbies>
    <hobby>reading</hobby>
    <hobby>gaming</hobby>
    <hobby>hiking</hobby>
  </hobbies>
  <active>true</active>
  <balance>1234.56</balance>
</person>`;

export const SAMPLE_SQL = `SELECT u.id, u.name, u.email, o.order_id, o.total
FROM users u
LEFT JOIN orders o ON u.id = o.user_id
WHERE u.active = true AND o.created_at >= '2024-01-01'
ORDER BY o.total DESC
LIMIT 100;`;
