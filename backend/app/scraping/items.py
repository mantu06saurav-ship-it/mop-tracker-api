import scrapy


class ScrapedItem(scrapy.Item):
    batch_id = scrapy.Field()
    portal = scrapy.Field()
    code_type = scrapy.Field()
    code = scrapy.Field()
    sku = scrapy.Field()
    mop = scrapy.Field()
    title = scrapy.Field()
    price_scraped = scrapy.Field()
    mrp = scrapy.Field()
    rating = scrapy.Field()
    reviews = scrapy.Field()
    seller = scrapy.Field()
    product_url = scrapy.Field()
    image_url = scrapy.Field()
    inventory_status = scrapy.Field()
    scrap_status = scrapy.Field()
    price_status = scrapy.Field()
    available_sizes = scrapy.Field()  # not persisted to dbo.mop_tracker (no such column) — kept for future use/logging
