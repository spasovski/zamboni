import sys

from django.db import connections, models, router
from django.db.models.deletion import Collector
from django.utils import encoding

import bleach
import commonware.log

import amo.models
from amo import urlresolvers
from . import utils


log = commonware.log.getLogger('z.translations')


class Translation(amo.models.ModelBase):
    """
    Translation model.

    Use :class:`translations.fields.TranslatedField` instead of a plain foreign
    key to this model.
    """

    autoid = models.AutoField(primary_key=True)
    id = models.IntegerField()
    locale = models.CharField(max_length=10)
    localized_string = models.TextField(null=True)
    localized_string_clean = models.TextField(null=True)

    class Meta:
        db_table = 'translations'
        unique_together = ('id', 'locale')

    def __unicode__(self):
        return self.localized_string and unicode(self.localized_string) or ''

    def __nonzero__(self):
        # __nonzero__ is called to evaluate an object in a boolean context.  We
        # want Translations to be falsy if their string is empty.
        return (bool(self.localized_string) and
                bool(self.localized_string.strip()))

    def __eq__(self, other):
        # Django implements an __eq__ that only checks pks.  We need to check
        # the strings if we're dealing with existing vs. unsaved Translations.
        return self.__cmp__(other) == 0

    def __cmp__(self, other):
        if hasattr(other, 'localized_string'):
            return cmp(self.localized_string, other.localized_string)
        else:
            return cmp(self.localized_string, other)

    def clean(self):
        if self.localized_string:
            self.localized_string = self.localized_string.strip()

    def save(self, **kwargs):
        self.clean()
        return super(Translation, self).save(**kwargs)

    def delete(self, using=None):
        # FIXME: if the Translation is the one used as default/fallback,
        # then deleting it will mean the corresponding field on the related
        # model will stay empty even if there are translations in other
        # languages!
        cls = self.__class__
        using = using or router.db_for_write(cls, instance=self)
        # Look for all translations for the same string (id=self.id) except the
        # current one (autoid=self.autoid).
        qs = cls.objects.filter(id=self.id).exclude(autoid=self.autoid)
        if qs.using(using).exists():
            # If other Translations for the same id exist, we just need to
            # delete this one and *only* this one, without letting Django
            # collect dependencies (it'd remove the others, which we want to
            # keep).
            assert self._get_pk_val() is not None
            collector = Collector(using=using)
            collector.collect([self], collect_related=False)
            # In addition, because we have FK pointing to a non-unique column,
            # we need to force MySQL to ignore constraints because it's dumb
            # and would otherwise complain even if there are remaining rows
            # that matches the FK.
            with connections[using].constraint_checks_disabled():
                collector.delete()
        else:
            # If no other Translations with that id exist, then we should let
            # django behave normally. It should find the related model and set
            # the FKs to NULL.
            return super(Translation, self).delete(using=using)

    delete.alters_data = True

    @classmethod
    def _cache_key(cls, pk, db):
        # Hard-coding the class name here so that subclasses don't try to cache
        # themselves under something like "o:translations.purifiedtranslation".
        #
        # Like in ModelBase, we avoid putting the real db in the key because it
        # does us more harm than good.
        key_parts = ('o', 'translations.translation', pk, 'default')
        return ':'.join(map(encoding.smart_unicode, key_parts))

    @classmethod
    def new(cls, string, locale, id=None):
        """
        Jumps through all the right hoops to create a new translation.

        If ``id`` is not given a new id will be created using
        ``translations_seq``.  Otherwise, the id will be used to add strings to
        an existing translation.

        To increment IDs we use a setting on MySQL. This is to support multiple
        database masters -- it's just crazy enough to work! See bug 756242.
        """
        if id is None:
            # Get a sequence key for the new translation.
            cursor = connections['default'].cursor()
            cursor.execute("""UPDATE translations_seq
                              SET id=LAST_INSERT_ID(id + @@global.auto_increment_increment)""")

            # The sequence table should never be empty. But alas, if it is,
            # let's fix it.
            if not cursor.rowcount > 0:
                cursor.execute("""INSERT INTO translations_seq (id)
                                  VALUES(LAST_INSERT_ID(id + @@global.auto_increment_increment))""")

            cursor.execute('SELECT LAST_INSERT_ID()')
            id = cursor.fetchone()[0]

        # Update if one exists, otherwise create a new one.
        q = {'id': id, 'locale': locale}
        try:
            trans = cls.objects.get(**q)
            trans.localized_string = string
        except cls.DoesNotExist:
            trans = cls(localized_string=string, **q)

        return trans


class PurifiedTranslation(Translation):
    """Run the string through bleach to get a safe, linkified version."""

    class Meta:
        proxy = True

    def __unicode__(self):
        if not self.localized_string_clean:
            self.clean()
        return unicode(self.localized_string_clean)

    def __html__(self):
        return unicode(self)

    def clean(self):
        from amo.utils import clean_nl
        super(PurifiedTranslation, self).clean()
        try:
            cleaned = bleach.clean(self.localized_string)
        except Exception as e:
            log.error('Failed to clean %s: %r' % (self.localized_string, e),
                      exc_info=sys.exc_info())
            cleaned = ''
        linkified = urlresolvers.linkify_with_outgoing(cleaned)
        self.localized_string_clean = clean_nl(linkified).strip()

    def __truncate__(self, length, killwords, end):
        return utils.truncate(unicode(self), length, killwords, end)


class LinkifiedTranslation(PurifiedTranslation):
    """Run the string through bleach to get a linkified version."""

    class Meta:
        proxy = True

    def clean(self):
        linkified = urlresolvers.linkify_with_outgoing(self.localized_string)
        try:
            clean = bleach.clean(linkified, tags=['a'],
                                 attributes={'a': ['href', 'rel']})
        except Exception as e:
            log.error('Failed to clean %s: %r' % (linkified, e),
                      exc_info=sys.exc_info())
            clean = ''
        self.localized_string_clean = clean


class TranslationSequence(models.Model):
    """
    The translations_seq table, so syncdb will create it during testing.
    """
    id = models.IntegerField(primary_key=True)

    class Meta:
        db_table = 'translations_seq'


def delete_translation(obj, fieldname):
    field = obj._meta.get_field(fieldname)
    trans_id = getattr(obj, field.attname)
    obj.update(**{field.name: None})
    if trans_id:
        Translation.objects.filter(id=trans_id).delete()
