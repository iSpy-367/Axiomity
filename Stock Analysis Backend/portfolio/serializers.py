from rest_framework import serializers

from stocks.models import Stock
from stocks.views import _resolve_symbol
from .models import Portfolio, BUY_BROKERAGE_RATE, SELL_BROKERAGE_RATE, BROKERAGE_RATE


def _script_code(normalized_symbol):
    return normalized_symbol.split('.')[0] if normalized_symbol else normalized_symbol


class PortfolioSerializer(serializers.ModelSerializer):
    symbol = serializers.CharField(required=True, allow_blank=False, write_only=True)
    current_price = serializers.SerializerMethodField()
    total_value = serializers.SerializerMethodField()
    pnl = serializers.SerializerMethodField()
    gross_pnl = serializers.SerializerMethodField()
    brokerage_cost = serializers.SerializerMethodField()
    net_pnl = serializers.SerializerMethodField()
    net_gain = serializers.SerializerMethodField()
    display_name = serializers.SerializerMethodField()
    daily_change_percent = serializers.SerializerMethodField()

    class Meta:
        model = Portfolio
        fields = [
            'id', 'symbol', 'display_name', 'quantity', 'buy_price',
            'buy_date', 'sell_date', 'status', 'exit_price',
            'realized_gross_pnl', 'realized_brokerage', 'realized_net_pnl',
            'date_added', 'current_price', 'total_value', 'pnl',
            'gross_pnl', 'brokerage_cost', 'net_pnl', 'net_gain',
            'daily_change_percent'
        ]
        read_only_fields = [
            'id', 'date_added', 'current_price', 'total_value',
            'pnl', 'gross_pnl', 'brokerage_cost', 'net_pnl', 'net_gain',
            'realized_gross_pnl', 'realized_brokerage', 'realized_net_pnl'
        ]

    def validate_quantity(self, value):
        if value <= 0:
            raise serializers.ValidationError('Quantity must be greater than zero.')
        return value

    def validate_buy_price(self, value):
        if value <= 0:
            raise serializers.ValidationError('Buy price must be greater than zero.')
        return value

    def validate_symbol(self, value):
        normalized = (value or '').strip().upper()
        if not normalized:
            raise serializers.ValidationError('A stock symbol is required.')
        return normalized

    def _resolve_stock(self, symbol):
        normalized = (symbol or '').strip().upper()
        if not normalized:
            return None

        # 1. Try canonical resolution first
        try:
            res = _resolve_symbol(normalized)
            if res and res[0]:
                resolved_symbol = res[0]
                info = res[1] or {}
                hist = res[2]
                stock_obj, _ = Stock.objects.get_or_create(symbol=resolved_symbol, defaults={'name': resolved_symbol})
                stock_obj.name = info.get('longName') or info.get('shortName') or stock_obj.name or resolved_symbol
                if hist is not None and not hist.empty:
                    valid_closes = hist['Close'].dropna()
                    valid_closes = valid_closes[valid_closes > 0]
                    if not valid_closes.empty:
                        stock_obj.current_price = float(valid_closes.iloc[-1])
                stock_obj.save()
                return stock_obj
        except Exception:
            pass

        # 2. Fallback to existing stock in DB
        stock = Stock.objects.filter(symbol__iexact=normalized).first()
        if not stock and '.' not in normalized:
            stock = Stock.objects.filter(symbol__iexact=f'{normalized}.NS').first()
            if not stock:
                stock = Stock.objects.filter(symbol__iexact=f'{normalized}.BO').first()

        return stock

    def create(self, validated_data):
        symbol = validated_data.pop('symbol', None)
        if not symbol:
            raise serializers.ValidationError({'symbol': 'A stock symbol is required.'})

        user = validated_data.pop('user', None) or self.context['request'].user
        stock = self._resolve_stock(symbol)
        if stock is None:
            stock, _ = Stock.objects.get_or_create(symbol=symbol, defaults={'name': symbol})

        # Check only ACTIVE positions for repeat purchase averaging
        existing = Portfolio.objects.filter(user=user, stock=stock, status='active').first()
        if existing is not None:
            total_quantity = existing.quantity + validated_data['quantity']
            if total_quantity <= 0:
                raise serializers.ValidationError({'quantity': 'Total quantity must be greater than zero.'})

            weighted_price = (
                existing.buy_price * existing.quantity + validated_data['buy_price'] * validated_data['quantity']
            ) / total_quantity
            existing.quantity = total_quantity
            existing.buy_price = round(weighted_price, 2)
            if 'buy_date' in validated_data:
                existing.buy_date = validated_data['buy_date']
            existing.save()
            return existing

        return Portfolio.objects.create(user=user, stock=stock, status='active', **validated_data)

    def get_current_price(self, instance):
        if instance.status == 'exited' and instance.exit_price is not None:
            return instance.exit_price
        return instance.stock.current_price or 0

    def get_display_name(self, instance):
        return f'{instance.stock.name} ({_script_code(instance.stock.symbol)})'

    def get_total_value(self, instance):
        price = self.get_current_price(instance)
        return round(price * instance.quantity, 2)

    def get_gross_pnl(self, instance):
        if instance.status == 'exited' and instance.realized_gross_pnl is not None:
            return round(instance.realized_gross_pnl, 2)
        current = instance.stock.current_price or instance.buy_price
        return round((current - instance.buy_price) * instance.quantity, 2)

    def get_pnl(self, instance):
        return self.get_gross_pnl(instance)

    def get_brokerage_cost(self, instance):
        if instance.status == 'exited' and instance.realized_brokerage is not None:
            return round(instance.realized_brokerage, 2)
        price = instance.stock.current_price or instance.buy_price
        buy_val = instance.buy_price * instance.quantity
        sell_val = price * instance.quantity
        buy_brokerage = BUY_BROKERAGE_RATE * buy_val
        sell_brokerage = SELL_BROKERAGE_RATE * sell_val
        return round(buy_brokerage + sell_brokerage, 2)

    def get_net_pnl(self, instance):
        if instance.status == 'exited' and instance.realized_net_pnl is not None:
            return round(instance.realized_net_pnl, 2)
        gross = self.get_gross_pnl(instance)
        brokerage = self.get_brokerage_cost(instance)
        return round(gross - brokerage, 2)

    def get_net_gain(self, instance):
        return self.get_net_pnl(instance)

    def get_daily_change_percent(self, instance):
        if instance.status == 'exited':
            return 0.0
        from stocks.models import StockHistory
        history = StockHistory.objects.filter(stock=instance.stock).order_by('-date')[:1]
        if history.exists():
            prev_close = history[0].close_price
            if prev_close > 0:
                current = instance.stock.current_price or prev_close
                change = ((current - prev_close) / prev_close) * 100
                return round(change, 2)
        return 0.0

    def to_representation(self, instance):
        data = super().to_representation(instance)
        raw_symbol = instance.stock.symbol
        data['symbol'] = raw_symbol.split('.')[0] if '.' in raw_symbol else raw_symbol
        return data
